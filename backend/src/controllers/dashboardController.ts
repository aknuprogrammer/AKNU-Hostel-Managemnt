import { Response } from 'express';
import { executeQuery } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { getActiveMealSession } from './mealScannerController.js';

export async function getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
  const role = req.user?.role || 'student';
  const today = new Date().toISOString().split('T')[0];

  try {
    const isScoped = req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0;
    const assignedHostels = req.user?.assignedHostels || [];
    const placeholders = assignedHostels.map((_, i) => `$${i + 1}`).join(',');
    const gender = req.user?.assignedCategory === 'girls' ? 'female' : (req.user?.assignedCategory === 'boys' ? 'male' : null);

    let studentCountQuery = 'SELECT COUNT(DISTINCT s.id) as c FROM students s WHERE s.hostel_status = \'active\'';
    let studentCountParams: any[] = [];
    if (isScoped) {
      if (gender) {
        studentCountQuery = `
          SELECT COUNT(DISTINCT s.id) as c 
          FROM students s 
          LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
          WHERE s.hostel_status = 'active' AND (sa.hostel_id IN (${placeholders}) OR (sa.hostel_id IS NULL AND s.gender = '${gender}'))
        `;
      } else {
        studentCountQuery = `
          SELECT COUNT(DISTINCT s.id) as c 
          FROM students s 
          JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
          WHERE s.hostel_status = 'active' AND sa.hostel_id IN (${placeholders})
        `;
      }
      studentCountParams = [...assignedHostels];
    }
    const studentCount = parseInt((await executeQuery(studentCountQuery, studentCountParams)).rows[0].c);

    let hostelCountQuery = 'SELECT COUNT(*) as c FROM hostels';
    let hostelCountParams: any[] = [];
    if (isScoped) {
      hostelCountQuery = `SELECT COUNT(*) as c FROM hostels WHERE id IN (${placeholders})`;
      hostelCountParams = [...assignedHostels];
    }
    const hostelCount = parseInt((await executeQuery(hostelCountQuery, hostelCountParams)).rows[0].c);

    let bedStatsQuery = `
      SELECT COUNT(*) as total_beds,
             COUNT(CASE WHEN b.status = 'occupied' THEN 1 END) as occupied_beds,
             COUNT(CASE WHEN b.status = 'vacant' THEN 1 END) as vacant_beds
      FROM beds b
      JOIN rooms r ON b.room_id = r.id
    `;
    let bedStatsParams: any[] = [];
    if (isScoped) {
      bedStatsQuery += ` WHERE r.hostel_id IN (${placeholders})`;
      bedStatsParams = [...assignedHostels];
    }
    const bedStats = (await executeQuery(bedStatsQuery, bedStatsParams)).rows[0];

    let todayMealsQuery = 'SELECT COUNT(*) as c FROM meal_transactions WHERE service_date = $1 AND status = \'SUCCESS\'';
    let todayMealsParams: any[] = [today];
    if (isScoped) {
      const mealPlaceholders = assignedHostels.map((_, i) => `$${i + 2}`).join(',');
      todayMealsQuery += ` AND hostel_id IN (${mealPlaceholders})`;
      todayMealsParams.push(...assignedHostels);
    }
    const todayMeals = parseInt((await executeQuery(todayMealsQuery, todayMealsParams)).rows[0].c);

    let complaintsQuery = 'SELECT COUNT(*) as c FROM complaints WHERE status NOT IN (\'resolved\', \'closed\')';
    let complaintsParams: any[] = [];
    if (isScoped) {
      complaintsQuery += ` AND hostel_id IN (${placeholders})`;
      complaintsParams = [...assignedHostels];
    }
    const activeComplaints = parseInt((await executeQuery(complaintsQuery, complaintsParams)).rows[0].c);

    let leavesQuery = `
      SELECT COUNT(*) as c 
      FROM leave_applications la
      JOIN students s ON la.student_id = s.id
      LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
      WHERE la.status = 'submitted'
    `;
    let leavesParams: any[] = [];
    if (isScoped) {
      if (gender) {
        leavesQuery += ` AND (sa.hostel_id IN (${placeholders}) OR (sa.hostel_id IS NULL AND s.gender = '${gender}'))`;
      } else {
        leavesQuery += ` AND sa.hostel_id IN (${placeholders})`;
      }
      leavesParams = [...assignedHostels];
    }
    const pendingLeaves = parseInt((await executeQuery(leavesQuery, leavesParams)).rows[0].c);

    const activeSession = await getActiveMealSession();

    // Announcements
    const announcements = (await executeQuery('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 5')).rows;

    // Recent activity audit logs for admins
    let recentAudits: any[] = [];
    if (['super_admin', 'univ_mgmt', 'chief_warden', 'hostel_warden'].includes(role)) {
      recentAudits = (await executeQuery(`
        SELECT al.*, u.full_name as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 8
      `)).rows;
    }

    // Dynamic Hostels List for Dashboard
    let hostelsListQuery = `
      SELECT h.id, h.name, h.code, h.category, h.campus, h.total_capacity,
             COALESCE((SELECT COUNT(*) FROM beds b JOIN rooms r ON b.room_id = r.id WHERE r.hostel_id = h.id), 0) as total_beds,
             COALESCE((SELECT COUNT(*) FROM beds b JOIN rooms r ON b.room_id = r.id WHERE r.hostel_id = h.id AND b.status = 'occupied'), 0) as occupied_beds
      FROM hostels h
    `;
    let hostelsListParams: any[] = [];
    if (isScoped) {
      hostelsListQuery += ` WHERE h.id IN (${placeholders})`;
      hostelsListParams = [...assignedHostels];
    } else if (gender) {
      const allowedCat = req.user?.assignedCategory;
      if (allowedCat === 'boys' || allowedCat === 'girls') {
        hostelsListQuery += ` WHERE h.category = '${allowedCat}'`;
      }
    }
    hostelsListQuery += ` ORDER BY h.category ASC, h.name ASC`;
    const hostelsListResult = await executeQuery(hostelsListQuery, hostelsListParams);
    const hostelsList = hostelsListResult.rows.map((h: any) => ({
      ...h,
      total_beds: parseInt(h.total_beds) || h.total_capacity || 0,
      occupied_beds: parseInt(h.occupied_beds) || 0
    }));

    // Role-specific metrics
    const stats: any = {
      totalStudents: studentCount,
      totalHostels: hostelCount,
      totalBeds: parseInt(bedStats.total_beds) || 0,
      occupiedBeds: parseInt(bedStats.occupied_beds) || 0,
      vacantBeds: parseInt(bedStats.vacant_beds) || 0,
      occupancyRate: bedStats.total_beds > 0 ? Math.round((bedStats.occupied_beds / bedStats.total_beds) * 100) : 0,
      todayMealsCount: todayMeals,
      activeComplaintsCount: activeComplaints,
      pendingLeavesCount: pendingLeaves,
      activeSession,
      announcements,
      recentAudits,
      hostels: hostelsList,
      assignedCategory: req.user?.assignedCategory || 'all'
    };

    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function executeAdminQuery(req: AuthRequest, res: Response): Promise<void> {
  const { sql, params } = req.body;
  if (!sql) {
    res.status(400).json({ success: false, error: 'SQL string is required' });
    return;
  }
  try {
    const result = await executeQuery(sql, params || []);
    res.json({ success: true, rows: result.rows, rowCount: result.rowCount });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

