import { Response } from 'express';
import { executeQuery } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { getActiveMealSession } from './mealScannerController.js';

export async function getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
  const role = req.user?.role || 'student';
  const today = new Date().toISOString().split('T')[0];

  try {
    const isSuperAdmin = req.user?.role === 'super_admin';
    const wing: 'boys' | 'girls' | null = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;
    const studentGender = wing === 'girls' ? 'female' : (wing === 'boys' ? 'male' : null);

    // 1. Student Count
    let studentCountQuery = `
      SELECT COUNT(DISTINCT s.id) as c 
      FROM students s 
      LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
      LEFT JOIN hostels h ON sa.hostel_id = h.id
      WHERE s.hostel_status = 'active'
    `;
    const studentCountParams: any[] = [];
    if (wing) {
      studentCountQuery += ` AND (h.category = $1 OR (sa.hostel_id IS NULL AND s.gender = $2))`;
      studentCountParams.push(wing, studentGender);
    }
    const studentCount = parseInt((await executeQuery(studentCountQuery, studentCountParams)).rows[0]?.c || '0');

    // 2. Hostel Count
    let hostelCountQuery = 'SELECT COUNT(*) as c FROM hostels';
    const hostelCountParams: any[] = [];
    if (wing) {
      hostelCountQuery += ' WHERE category = $1';
      hostelCountParams.push(wing);
    }
    const hostelCount = parseInt((await executeQuery(hostelCountQuery, hostelCountParams)).rows[0]?.c || '0');

    // 3. Bed Stats
    let bedStatsQuery = `
      SELECT COUNT(b.id) as total_beds,
             COUNT(CASE WHEN b.status = 'occupied' THEN 1 END) as occupied_beds,
             COUNT(CASE WHEN b.status = 'vacant' THEN 1 END) as vacant_beds
      FROM beds b
      JOIN rooms r ON b.room_id = r.id
      JOIN hostels h ON r.hostel_id = h.id
    `;
    const bedStatsParams: any[] = [];
    if (wing) {
      bedStatsQuery += ' WHERE h.category = $1';
      bedStatsParams.push(wing);
    }
    const bedStats = (await executeQuery(bedStatsQuery, bedStatsParams)).rows[0] || {
      total_beds: 0,
      occupied_beds: 0,
      vacant_beds: 0
    };

    // 4. Today's Meals Count
    let todayMealsQuery = `
      SELECT COUNT(mt.id) as c 
      FROM meal_transactions mt 
      JOIN hostels h ON mt.hostel_id = h.id
      WHERE mt.service_date = $1 AND mt.status = 'SUCCESS'
    `;
    const todayMealsParams: any[] = [today];
    if (wing) {
      todayMealsQuery += ' AND h.category = $2';
      todayMealsParams.push(wing);
    }
    const todayMeals = parseInt((await executeQuery(todayMealsQuery, todayMealsParams)).rows[0]?.c || '0');

    // 5. Active Complaints Count
    let complaintsQuery = `
      SELECT COUNT(c.id) as c 
      FROM complaints c
      JOIN hostels h ON c.hostel_id = h.id
      WHERE c.status NOT IN ('resolved', 'closed')
    `;
    const complaintsParams: any[] = [];
    if (wing) {
      complaintsQuery += ' AND h.category = $1';
      complaintsParams.push(wing);
    }
    const activeComplaints = parseInt((await executeQuery(complaintsQuery, complaintsParams)).rows[0]?.c || '0');

    // 6. Pending Leaves Count
    let leavesQuery = `
      SELECT COUNT(la.id) as c 
      FROM leave_applications la
      JOIN students s ON la.student_id = s.id
      LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
      LEFT JOIN hostels h ON sa.hostel_id = h.id
      WHERE la.status = 'submitted'
    `;
    const leavesParams: any[] = [];
    if (wing) {
      leavesQuery += ` AND (h.category = $1 OR (sa.hostel_id IS NULL AND s.gender = $2))`;
      leavesParams.push(wing, studentGender);
    }
    const pendingLeaves = parseInt((await executeQuery(leavesQuery, leavesParams)).rows[0]?.c || '0');

    // 7. Active Meal Session
    const activeSession = await getActiveMealSession();

    // 8. Announcements
    const announcements = (await executeQuery('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 5')).rows;

    // 9. Recent Audits (Strict Wing Isolation)
    let recentAudits: any[] = [];
    if (['super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'].includes(role)) {
      let auditSql = `
        SELECT al.*, u.full_name as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
      `;
      const auditParams: any[] = [];
      if (wing) {
        auditSql += ` WHERE (u.gender_wing = $1 OR u.gender_wing = 'all' OR u.id = $2)`;
        auditParams.push(wing, req.user?.id || 'none');
      }
      auditSql += ` ORDER BY al.created_at DESC LIMIT 8`;
      recentAudits = (await executeQuery(auditSql, auditParams)).rows;
    }

    // 10. Dynamic Hostels List for Dashboard (STRICT WING ISOLATION)
    let hostelsListQuery = `
      SELECT h.id, h.name, h.code, h.category, h.campus, h.total_capacity,
             COALESCE((SELECT COUNT(*) FROM beds b JOIN rooms r ON b.room_id = r.id WHERE r.hostel_id = h.id), 0) as total_beds,
             COALESCE((SELECT COUNT(*) FROM beds b JOIN rooms r ON b.room_id = r.id WHERE r.hostel_id = h.id AND b.status = 'occupied'), 0) as occupied_beds
      FROM hostels h
    `;
    const hostelsListParams: any[] = [];
    if (wing) {
      hostelsListQuery += ` WHERE h.category = $1`;
      hostelsListParams.push(wing);
    }
    hostelsListQuery += ` ORDER BY h.category ASC, h.name ASC`;

    const hostelsListResult = await executeQuery(hostelsListQuery, hostelsListParams);
    const hostelsList = hostelsListResult.rows.map((h: any) => ({
      ...h,
      total_beds: parseInt(h.total_beds) || h.total_capacity || 0,
      occupied_beds: parseInt(h.occupied_beds) || 0
    }));

    const totalBeds = parseInt(bedStats.total_beds) || 0;
    const occupiedBeds = parseInt(bedStats.occupied_beds) || 0;
    const vacantBeds = parseInt(bedStats.vacant_beds) || 0;

    const stats = {
      totalStudents: studentCount,
      totalHostels: hostelCount,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      todayMealsCount: todayMeals,
      activeComplaintsCount: activeComplaints,
      pendingLeavesCount: pendingLeaves,
      activeSession,
      announcements,
      recentAudits,
      hostels: hostelsList,
      assignedCategory: wing || 'all'
    };

    res.json({ success: true, data: stats });
  } catch (err: any) {
    console.error('[Dashboard Stats Error]', err);
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
