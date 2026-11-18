import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, executeTransaction } from '../config/database.js';
import { AuthRequest, logAudit } from '../middleware/auth.js';

export async function getMessMenu(req: AuthRequest, res: Response): Promise<void> {
  const { hostelId, dayOfWeek } = req.query;

  if (!hostelId) {
    res.json({ success: true, data: [] });
    return;
  }

  try {
    // RBAC: Wing boundary restriction
    const isSuperAdmin = req.user?.role === 'super_admin';
    const wing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;

    if (wing) {
      const hCheck = await executeQuery('SELECT category FROM hostels WHERE id = $1', [hostelId]);
      if (hCheck.rows.length === 0 || hCheck.rows[0].category !== wing) {
        res.status(403).json({ success: false, error: 'Access denied: Cannot access mess menu of a hostel outside your assigned wing' });
        return;
      }
    }

    let sql = `
      SELECT mm.*, ms.name as session_name, ms.code as session_code, ms.start_time, ms.end_time
      FROM mess_menus mm
      JOIN meal_sessions ms ON mm.meal_session_id = ms.id
      WHERE mm.hostel_id = $1
    `;
    const params: any[] = [hostelId];

    if (dayOfWeek) {
      params.push(dayOfWeek);
      sql += ' AND mm.day_of_week = $2';
    }

    sql += ' ORDER BY ms.start_time ASC';

    const menus = await executeQuery(sql, params);
    if (menus.rows.length > 0) {
      res.json({ success: true, data: menus.rows });
      return;
    }

    // Default dynamic fallback if no custom rows configured yet:
    const hostelInfo = await executeQuery('SELECT name, code, category FROM hostels WHERE id = $1', [hostelId]);
    const isGirls = hostelInfo.rows.length > 0
      ? hostelInfo.rows[0].category === 'girls' || hostelInfo.rows[0].name.toLowerCase().includes('girl')
      : String(hostelId).toLowerCase().includes('gh') || String(hostelId).toLowerCase().includes('girl');

    const sessions = await executeQuery('SELECT * FROM meal_sessions WHERE is_active = true ORDER BY start_time ASC');
    const day = (dayOfWeek as string) || 'Monday';

    const defaultMenus = sessions.rows.map((s) => {
      let items = '';
      if (s.code === 'breakfast') {
        items = isGirls
          ? 'Masala Dosa, Upma, Coconut Chutney, Sambar, Tea / Coffee'
          : 'Idli, Medu Vada, Peanut Chutney, Sambar, Tea / Coffee';
      } else if (s.code === 'lunch') {
        items = isGirls
          ? 'Steamed Rice, Palak Pappu, Mixed Veg Kurma, Majjiga Pulusu, Fresh Curd'
          : 'Steamed Rice, Andhra Tomato Pappu, Aloo Fry, Sambar, Fresh Curd, Papad';
      } else if (s.code === 'snacks') {
        items = isGirls
          ? 'Green Tea / Fresh Milk, Osmania Biscuits (Optional Counter)'
          : 'Evening Tea / Coffee, Salted Biscuits';
      } else {
        items = isGirls
          ? 'Phulka Roti, Paneer Butter Masala, Veg Biryani, Rasam, Curd'
          : 'Phulka Chapati, Chana Masala, Jeera Rice, Rasam, Fresh Curd';
      }

      return {
        id: `def-${s.id}-${hostelId}-${day}`,
        hostel_id: hostelId,
        day_of_week: day,
        meal_session_id: s.id,
        session_name: s.name,
        session_code: s.code,
        start_time: s.start_time,
        end_time: s.end_time,
        menu_items: items,
        is_special: false
      };
    });

    res.json({ success: true, data: defaultMenus });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateMessMenu(req: AuthRequest, res: Response): Promise<void> {
  const { hostelId, dayOfWeek, mealSessionId, menuItems, isSpecial } = req.body;

  if (!hostelId || !dayOfWeek || !mealSessionId || !menuItems) {
    res.status(400).json({ success: false, error: 'Hostel, day, session, and menu items are required' });
    return;
  }

  try {
    const isSuperAdmin = req.user?.role === 'super_admin';
    const wing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;

    if (wing) {
      const hCheck = await executeQuery('SELECT category FROM hostels WHERE id = $1', [hostelId]);
      if (hCheck.rows.length === 0 || hCheck.rows[0].category !== wing) {
        res.status(403).json({ success: false, error: 'Access denied: Cannot update mess menu of a hostel outside your assigned wing' });
        return;
      }
    }

    const existing = await executeQuery(
      `SELECT id FROM mess_menus WHERE hostel_id = $1 AND day_of_week = $2 AND meal_session_id = $3`,
      [hostelId, dayOfWeek, mealSessionId]
    );

    if (existing.rowCount > 0) {
      await executeQuery(
        `UPDATE mess_menus SET menu_items = $1, is_special = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [menuItems, isSpecial || false, existing.rows[0].id]
      );
    } else {
      const menuId = uuidv4();
      await executeQuery(
        `INSERT INTO mess_menus (id, hostel_id, day_of_week, meal_session_id, menu_items, is_special)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [menuId, hostelId, dayOfWeek, mealSessionId, menuItems, isSpecial || false]
      );
    }

    await logAudit(req.user?.id, 'UPDATE_MESS_MENU', 'mess_menu', undefined, { hostelId, dayOfWeek, mealSessionId }, req);

    res.json({ success: true, message: 'Mess menu updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getInventory(req: AuthRequest, res: Response): Promise<void> {
  const { hostelId } = req.query;

  if (!hostelId) {
    res.json({ success: true, data: [] });
    return;
  }

  try {
    const items = await executeQuery(
      `SELECT *, (quantity <= min_stock_threshold) as is_low_stock
       FROM mess_inventory
       WHERE hostel_id = $1
       ORDER BY item_name ASC`,
      [hostelId]
    );

    res.json({ success: true, data: items.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function recordInventoryTransaction(req: AuthRequest, res: Response): Promise<void> {
  const { inventoryItemId, transactionType, quantity, notes } = req.body; // transactionType: 'IN' | 'OUT' | 'WASTAGE'

  if (!inventoryItemId || !['IN', 'OUT', 'WASTAGE'].includes(transactionType) || !quantity || quantity <= 0) {
    res.status(400).json({ success: false, error: 'Valid item, transaction type (IN/OUT/WASTAGE), and positive quantity required' });
    return;
  }

  try {
    const txId = uuidv4();
    await executeTransaction(async (query) => {
      await query(
        `INSERT INTO mess_inventory_transactions (id, inventory_item_id, transaction_type, quantity, recorded_by_user_id, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [txId, inventoryItemId, transactionType, quantity, req.user?.id, notes || null]
      );

      const qtyDelta = transactionType === 'IN' ? quantity : -quantity;
      await query(
        `UPDATE mess_inventory
         SET quantity = GREATEST(0, quantity + $1), last_restocked_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [qtyDelta, inventoryItemId]
      );
    });

    res.json({ success: true, message: `Inventory ${transactionType} transaction recorded` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function recordFoodWastage(req: AuthRequest, res: Response): Promise<void> {
  const { hostelId, mealSessionId, weightKg, reason } = req.body;

  if (!hostelId || !mealSessionId || !weightKg || weightKg <= 0) {
    res.status(400).json({ success: false, error: 'Hostel, meal session, and positive wastage weight (kg) required' });
    return;
  }

  try {
    const wastageId = uuidv4();
    const serviceDate = new Date().toISOString().split('T')[0];

    await executeQuery(
      `INSERT INTO food_wastage_logs (id, hostel_id, meal_session_id, service_date, weight_kg, recorded_by_user_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [wastageId, hostelId, mealSessionId, serviceDate, weightKg, req.user?.id, reason || null]
    );

    res.json({ success: true, message: 'Food wastage recorded successfully', data: { wastageId } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMealSessions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const sessions = await executeQuery('SELECT * FROM meal_sessions WHERE is_active = true ORDER BY start_time ASC');
    res.json({ success: true, data: sessions.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteMessMenu(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    await executeQuery('DELETE FROM mess_menus WHERE id = $1', [id]);
    res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
// ============================================================================
// STUDENT DAILY MEAL ATTENDANCE & FOOD PREPARATION HEADCOUNT
// ============================================================================

export async function getMealAttendanceCounts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const isSuperAdmin = req.user?.role === 'super_admin';
    const wing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;

    const dateParam = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const hostelId = req.query.hostelId as string | undefined;

    let hostelFilter = '';
    const params: any[] = [dateParam];

    if (hostelId) {
      params.push(hostelId);
      hostelFilter += ` AND sa.hostel_id = $${params.length}`;
    }

    if (wing) {
      params.push(wing);
      hostelFilter += ` AND h.category = $${params.length}`;
    }

    // Fetch all active residents allocated to rooms
    const residentsQuery = `
      SELECT s.id as student_id, s.full_name, s.roll_number,
             sa.hostel_id, h.name as hostel_name, h.category as hostel_category,
             r.room_number,
             sma.breakfast, sma.lunch, sma.snacks, sma.dinner, sma.source,
             la.id as leave_id, la.leave_type
      FROM students s
      JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
      JOIN hostels h ON sa.hostel_id = h.id
      JOIN rooms r ON sa.room_id = r.id
      LEFT JOIN student_meal_attendance sma ON s.id = sma.student_id AND sma.service_date = $1
      LEFT JOIN leave_applications la ON s.id = la.student_id 
           AND la.status = 'approved' 
           AND $1 BETWEEN la.start_date::date AND la.end_date::date
      WHERE 1=1 ${hostelFilter}
      ORDER BY h.name ASC, r.room_number ASC, s.full_name ASC
    `;

    const result = await executeQuery(residentsQuery, params);
    const residents = result.rows;

    let totalResidents = residents.length;
    let onLeaveCount = 0;
    let breakfastCount = 0;
    let lunchCount = 0;
    let snacksCount = 0;
    let dinnerCount = 0;

    const hostelBreakdown: Record<string, {
      hostelId: string;
      hostelName: string;
      category: string;
      total: number;
      breakfast: number;
      lunch: number;
      snacks: number;
      dinner: number;
      onLeave: number;
    }> = {};

    for (const r of residents) {
      const isOnLeave = !!r.leave_id;
      if (isOnLeave) onLeaveCount++;

      // If record exists in student_meal_attendance, respect student's choices;
      // if on approved leave and no manual override, defaults to false (opted out).
      // otherwise, default to true (all active hostel residents eat meals).
      const b = r.breakfast !== null && r.breakfast !== undefined ? Boolean(r.breakfast) : !isOnLeave;
      const l = r.lunch !== null && r.lunch !== undefined ? Boolean(r.lunch) : !isOnLeave;
      const s = r.snacks !== null && r.snacks !== undefined ? Boolean(r.snacks) : !isOnLeave;
      const d = r.dinner !== null && r.dinner !== undefined ? Boolean(r.dinner) : !isOnLeave;

      if (b) breakfastCount++;
      if (l) lunchCount++;
      if (s) snacksCount++;
      if (d) dinnerCount++;

      const hId = r.hostel_id;
      if (!hostelBreakdown[hId]) {
        hostelBreakdown[hId] = {
          hostelId: hId,
          hostelName: r.hostel_name,
          category: r.hostel_category,
          total: 0,
          breakfast: 0,
          lunch: 0,
          snacks: 0,
          dinner: 0,
          onLeave: 0
        };
      }
      hostelBreakdown[hId].total++;
      if (isOnLeave) hostelBreakdown[hId].onLeave++;
      if (b) hostelBreakdown[hId].breakfast++;
      if (l) hostelBreakdown[hId].lunch++;
      if (s) hostelBreakdown[hId].snacks++;
      if (d) hostelBreakdown[hId].dinner++;
    }

    res.json({
      success: true,
      data: {
        date: dateParam,
        totalResidents,
        onLeaveCount,
        counts: {
          breakfast: { attending: breakfastCount, skipped: totalResidents - breakfastCount },
          lunch: { attending: lunchCount, skipped: totalResidents - lunchCount },
          snacks: { attending: snacksCount, skipped: totalResidents - snacksCount },
          dinner: { attending: dinnerCount, skipped: totalResidents - dinnerCount }
        },
        hostels: Object.values(hostelBreakdown)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMealAttendanceRoster(req: AuthRequest, res: Response): Promise<void> {
  try {
    const isSuperAdmin = req.user?.role === 'super_admin';
    const wing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;

    const dateParam = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const hostelId = req.query.hostelId as string | undefined;
    const search = req.query.search as string | undefined;

    let whereClause = '';
    const params: any[] = [dateParam];

    if (hostelId) {
      params.push(hostelId);
      whereClause += ` AND sa.hostel_id = $${params.length}`;
    }

    if (wing) {
      params.push(wing);
      whereClause += ` AND h.category = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      whereClause += ` AND (LOWER(s.full_name) LIKE $${params.length} OR LOWER(s.roll_number) LIKE $${params.length} OR LOWER(r.room_number) LIKE $${params.length})`;
    }

    const query = `
      SELECT s.id as student_id, s.full_name, s.roll_number, s.phone,
             sa.hostel_id, h.name as hostel_name, h.category as hostel_category,
             r.room_number,
             sma.id as attendance_id, sma.breakfast, sma.lunch, sma.snacks, sma.dinner,
             sma.source, sma.notes, sma.updated_at,
             la.id as leave_id, la.leave_type
      FROM students s
      JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
      JOIN hostels h ON sa.hostel_id = h.id
      JOIN rooms r ON sa.room_id = r.id
      LEFT JOIN student_meal_attendance sma ON s.id = sma.student_id AND sma.service_date = $1
      LEFT JOIN leave_applications la ON s.id = la.student_id 
           AND la.status = 'approved' 
           AND $1 BETWEEN la.start_date::date AND la.end_date::date
      WHERE 1=1 ${whereClause}
      ORDER BY h.name ASC, r.room_number ASC, s.full_name ASC
    `;

    const result = await executeQuery(query, params);

    const roster = result.rows.map((row) => {
      const isOnLeave = !!row.leave_id;
      return {
        studentId: row.student_id,
        fullName: row.full_name,
        rollNumber: row.roll_number,
        phone: row.phone,
        hostelId: row.hostel_id,
        hostelName: row.hostel_name,
        hostelCategory: row.hostel_category,
        roomNumber: row.room_number,
        breakfast: row.breakfast !== null && row.breakfast !== undefined ? Boolean(row.breakfast) : !isOnLeave,
        lunch: row.lunch !== null && row.lunch !== undefined ? Boolean(row.lunch) : !isOnLeave,
        snacks: row.snacks !== null && row.snacks !== undefined ? Boolean(row.snacks) : !isOnLeave,
        dinner: row.dinner !== null && row.dinner !== undefined ? Boolean(row.dinner) : !isOnLeave,
        isOnLeave,
        leaveType: row.leave_type || null,
        source: row.source || (isOnLeave ? 'LEAVE_SYNC' : 'DEFAULT'),
        updatedAt: row.updated_at || null
      };
    });

    res.json({ success: true, data: roster });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMyMealAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const studentUserRes = await executeQuery(
      `SELECT s.id as student_id, sa.hostel_id, h.name as hostel_name
       FROM students s
       JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       JOIN hostels h ON sa.hostel_id = h.id
       WHERE s.user_id = $1`,
      [req.user!.id]
    );

    if (studentUserRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'No active resident student profile found for this account' });
      return;
    }

    const { student_id, hostel_id, hostel_name } = studentUserRes.rows[0];
    const dateParam = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const attRes = await executeQuery(
      `SELECT breakfast, lunch, snacks, dinner, source, updated_at
       FROM student_meal_attendance
       WHERE student_id = $1 AND service_date = $2`,
      [student_id, dateParam]
    );

    // Check if on leave
    const leaveRes = await executeQuery(
      `SELECT id, leave_type FROM leave_applications
       WHERE student_id = $1 AND status = 'approved' AND $2 BETWEEN start_date::date AND end_date::date`,
      [student_id, dateParam]
    );
    const isOnLeave = leaveRes.rows.length > 0;

    let breakfast = !isOnLeave;
    let lunch = !isOnLeave;
    let snacks = !isOnLeave;
    let dinner = !isOnLeave;
    let source = isOnLeave ? 'LEAVE_SYNC' : 'DEFAULT';

    if (attRes.rows.length > 0) {
      const row = attRes.rows[0];
      breakfast = Boolean(row.breakfast);
      lunch = Boolean(row.lunch);
      snacks = Boolean(row.snacks);
      dinner = Boolean(row.dinner);
      source = row.source;
    }

    res.json({
      success: true,
      data: {
        date: dateParam,
        studentId: student_id,
        hostelId: hostel_id,
        hostelName: hostel_name,
        breakfast,
        lunch,
        snacks,
        dinner,
        isOnLeave,
        leaveType: isOnLeave ? leaveRes.rows[0].leave_type : null,
        source
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function toggleMyMealAttendance(req: AuthRequest, res: Response): Promise<void> {
  const { date, meal, attending } = req.body;

  if (!date || !meal || typeof attending !== 'boolean') {
    res.status(400).json({ success: false, error: 'Date, meal (breakfast/lunch/snacks/dinner), and attending flag required' });
    return;
  }

  const validMeals = ['breakfast', 'lunch', 'snacks', 'dinner'];
  if (!validMeals.includes(meal.toLowerCase())) {
    res.status(400).json({ success: false, error: 'Meal must be breakfast, lunch, snacks, or dinner' });
    return;
  }

  try {
    const studentUserRes = await executeQuery(
      `SELECT s.id as student_id, sa.hostel_id
       FROM students s
       JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       WHERE s.user_id = $1`,
      [req.user!.id]
    );

    if (studentUserRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Active resident record not found' });
      return;
    }

    const { student_id, hostel_id } = studentUserRes.rows[0];
    const cleanMeal = meal.toLowerCase();

    // Check if record exists
    const existing = await executeQuery(
      'SELECT id, breakfast, lunch, snacks, dinner FROM student_meal_attendance WHERE student_id = $1 AND service_date = $2',
      [student_id, date]
    );

    if (existing.rows.length === 0) {
      const newId = `att-${uuidv4().slice(0, 8)}`;
      // Default other meals to true
      const b = cleanMeal === 'breakfast' ? attending : true;
      const l = cleanMeal === 'lunch' ? attending : true;
      const s = cleanMeal === 'snacks' ? attending : true;
      const d = cleanMeal === 'dinner' ? attending : true;

      await executeQuery(
        `INSERT INTO student_meal_attendance (id, student_id, hostel_id, service_date, breakfast, lunch, snacks, dinner, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'STUDENT_APP')`,
        [newId, student_id, hostel_id, date, b, l, s, d]
      );
    } else {
      await executeQuery(
        `UPDATE student_meal_attendance 
         SET ${cleanMeal} = $1, source = 'STUDENT_APP', updated_at = CURRENT_TIMESTAMP
         WHERE student_id = $2 AND service_date = $3`,
        [attending, student_id, date]
      );
    }

    res.json({
      success: true,
      message: `Meal preference for ${cleanMeal} on ${date} saved as ${attending ? 'Attending' : 'Skipping / Opted Out'}.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function staffUpdateMealAttendance(req: AuthRequest, res: Response): Promise<void> {
  const { studentId, date, breakfast, lunch, snacks, dinner, notes } = req.body;

  if (!studentId || !date) {
    res.status(400).json({ success: false, error: 'Student ID and date are required' });
    return;
  }

  try {
    const allocCheck = await executeQuery(
      `SELECT sa.hostel_id FROM student_allocations sa WHERE sa.student_id = $1 AND sa.status = 'active'`,
      [studentId]
    );

    if (allocCheck.rows.length === 0) {
      res.status(404).json({ success: false, error: 'No active hostel allocation found for this student' });
      return;
    }

    const hostel_id = allocCheck.rows[0].hostel_id;

    const existing = await executeQuery(
      'SELECT id, breakfast, lunch, snacks, dinner FROM student_meal_attendance WHERE student_id = $1 AND service_date = $2',
      [studentId, date]
    );

    if (existing.rows.length === 0) {
      const newId = `att-${uuidv4().slice(0, 8)}`;
      await executeQuery(
        `INSERT INTO student_meal_attendance (id, student_id, hostel_id, service_date, breakfast, lunch, snacks, dinner, source, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'WARDEN_OVERRIDE', $9)`,
        [
          newId,
          studentId,
          hostel_id,
          date,
          breakfast !== undefined ? breakfast : true,
          lunch !== undefined ? lunch : true,
          snacks !== undefined ? snacks : true,
          dinner !== undefined ? dinner : true,
          notes || null
        ]
      );
    } else {
      await executeQuery(
        `UPDATE student_meal_attendance
         SET breakfast = COALESCE($1, breakfast),
             lunch = COALESCE($2, lunch),
             snacks = COALESCE($3, snacks),
             dinner = COALESCE($4, dinner),
             source = 'WARDEN_OVERRIDE',
             notes = COALESCE($5, notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE student_id = $6 AND service_date = $7`,
        [
          breakfast !== undefined ? breakfast : null,
          lunch !== undefined ? lunch : null,
          snacks !== undefined ? snacks : null,
          dinner !== undefined ? dinner : null,
          notes || null,
          studentId,
          date
        ]
      );
    }

    res.json({ success: true, message: 'Student meal attendance updated successfully by staff.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function staffBulkMarkAttendance(req: AuthRequest, res: Response): Promise<void> {
  const { hostelId, date, meal, attending } = req.body;

  if (!hostelId || !date || typeof attending !== 'boolean') {
    res.status(400).json({ success: false, error: 'Hostel ID, date, and attending flag are required' });
    return;
  }

  try {
    const residents = await executeQuery(
      `SELECT sa.student_id FROM student_allocations sa WHERE sa.hostel_id = $1 AND sa.status = 'active'`,
      [hostelId]
    );

    if (residents.rows.length === 0) {
      res.json({ success: true, message: 'No active residents found in this hostel.' });
      return;
    }

    const cleanMeal = meal ? meal.toLowerCase() : 'all';

    await executeTransaction(async (query) => {
      for (const r of residents.rows) {
        const studentId = r.student_id;
        const newId = `att-${uuidv4().slice(0, 8)}`;
        if (cleanMeal === 'all') {
          await query(
            `INSERT INTO student_meal_attendance (id, student_id, hostel_id, service_date, breakfast, lunch, snacks, dinner, source)
             VALUES ($1, $2, $3, $4, $5, $5, $5, $5, 'WARDEN_OVERRIDE')
             ON CONFLICT (student_id, service_date) DO UPDATE
             SET breakfast = EXCLUDED.breakfast,
                 lunch = EXCLUDED.lunch,
                 snacks = EXCLUDED.snacks,
                 dinner = EXCLUDED.dinner,
                 source = 'WARDEN_OVERRIDE',
                 updated_at = CURRENT_TIMESTAMP`,
            [newId, studentId, hostelId, date, attending]
          );
        } else {
          await query(
            `INSERT INTO student_meal_attendance (id, student_id, hostel_id, service_date, breakfast, lunch, snacks, dinner, source)
             VALUES ($1, $2, $3, $4, true, true, true, true, 'WARDEN_OVERRIDE')
             ON CONFLICT (student_id, service_date) DO UPDATE
             SET ${cleanMeal} = $5,
                 source = 'WARDEN_OVERRIDE',
                 updated_at = CURRENT_TIMESTAMP`,
            [newId, studentId, hostelId, date, attending]
          );
        }
      }
    });

    res.json({
      success: true,
      message: `Bulk marked ${residents.rows.length} residents in hostel for ${cleanMeal === 'all' ? 'all meals' : cleanMeal} as ${attending ? 'Attending' : 'Skipped'}.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
