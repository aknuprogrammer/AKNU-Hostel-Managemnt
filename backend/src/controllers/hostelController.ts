import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, executeTransaction } from '../config/database.js';
import { AuthRequest, logAudit } from '../middleware/auth.js';

export async function getHostels(req: AuthRequest, res: Response): Promise<void> {
  try {
    const whereClauses: string[] = [];
    const params: any[] = [];

    // Enforce strict gender wing isolation
    if (req.user?.role !== 'super_admin' && req.user?.assignedCategory && req.user.assignedCategory !== 'all') {
      params.push(req.user.assignedCategory);
      whereClauses.push(`h.category = $${params.length}`);
    }

    if (req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
      const placeholders = req.user.assignedHostels.map((_, i) => `$${params.length + i + 1}`).join(',');
      whereClauses.push(`h.id IN (${placeholders})`);
      params.push(...req.user.assignedHostels);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const hostelsRes = await executeQuery(`
      SELECT h.*, u.full_name as chief_warden_name,
             (SELECT COUNT(*) FROM rooms r WHERE r.hostel_id = h.id) as total_rooms,
             (SELECT COUNT(*) FROM beds b JOIN rooms r ON b.room_id = r.id WHERE r.hostel_id = h.id) as total_beds,
             (SELECT COUNT(*) FROM beds b JOIN rooms r ON b.room_id = r.id WHERE r.hostel_id = h.id AND b.status = 'occupied') as occupied_beds
      FROM hostels h
      LEFT JOIN users u ON h.chief_warden_id = u.id
      ${whereClause}
      ORDER BY h.name ASC
    `, params);

    res.json({ success: true, data: hostelsRes.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getHostelDetails(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    if (req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
      if (!req.user.assignedHostels.includes(id)) {
        res.status(403).json({ success: false, error: 'Access denied to this hostel' });
        return;
      }
    }

    const hostelRes = await executeQuery('SELECT * FROM hostels WHERE id = $1', [id]);
    if (hostelRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Hostel not found' });
      return;
    }

    // Wing separation check
    if (req.user?.role !== 'super_admin' && req.user?.assignedCategory && req.user.assignedCategory !== 'all') {
      if (hostelRes.rows[0].category !== req.user.assignedCategory) {
        res.status(403).json({ success: false, error: 'Access denied: Cannot access hostel from a different gender wing' });
        return;
      }
    }

    const blocks = await executeQuery('SELECT * FROM blocks WHERE hostel_id = $1 ORDER BY code ASC', [id]);
    const rooms = await executeQuery(`
      SELECT r.*, f.floor_number, f.name as floor_name, b.code as block_code
      FROM rooms r
      JOIN floors f ON r.floor_id = f.id
      JOIN blocks b ON f.block_id = b.id
      WHERE r.hostel_id = $1
      ORDER BY r.room_number ASC
    `, [id]);

    res.json({
      success: true,
      data: {
        hostel: hostelRes.rows[0],
        blocks: blocks.rows,
        rooms: rooms.rows
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getRoomsWithBeds(req: AuthRequest, res: Response): Promise<void> {
  const { hostelId, status } = req.query;
  try {
    let sql = `
      SELECT r.id as room_id, r.room_number, r.capacity, r.current_occupancy, r.room_type, r.status as room_status,
             r.floor_id, f.id as floor_table_id, f.floor_number, f.name as floor_name,
             h.id as hostel_id, h.name as hostel_name,
             b.id as bed_id, b.bed_number, b.status as bed_status,
             s.id as student_id, s.full_name as student_name, s.roll_number
      FROM rooms r
      JOIN hostels h ON r.hostel_id = h.id
      LEFT JOIN floors f ON r.floor_id = f.id
      LEFT JOIN beds b ON r.id = b.room_id
      LEFT JOIN student_allocations sa ON b.id = sa.bed_id AND sa.status = 'active'
      LEFT JOIN students s ON sa.student_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Enforce strict gender wing isolation
    if (req.user?.role !== 'super_admin' && req.user?.assignedCategory && req.user.assignedCategory !== 'all') {
      params.push(req.user.assignedCategory);
      sql += ` AND h.category = $${params.length}`;
    }

    if (req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
      const placeholders = req.user.assignedHostels.map((_, i) => `$${params.length + i + 1}`).join(',');
      sql += ` AND h.id IN (${placeholders})`;
      params.push(...req.user.assignedHostels);
    }
    if (hostelId) {
      params.push(hostelId);
      sql += ` AND r.hostel_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND b.status = $${params.length}`;
    }

    sql += ' ORDER BY r.room_number, b.bed_number';

    const result = await executeQuery(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function allocateBed(req: AuthRequest, res: Response): Promise<void> {
  const { studentId, hostelId, roomId, bedId, academicYearId, checkInDate = new Date().toISOString().split('T')[0], notes } = req.body;

  if (!studentId || !hostelId || !roomId || !bedId) {
    res.status(400).json({ success: false, error: 'Student, hostel, room, and bed IDs are required' });
    return;
  }

  if (req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
    if (!req.user.assignedHostels.includes(hostelId)) {
      res.status(403).json({ success: false, error: 'Cannot allocate beds in a hostel outside your assigned wing' });
      return;
    }
  }

  try {
    await executeTransaction(async (query) => {
      // Check bed availability
      const bedRes = await query('SELECT status FROM beds WHERE id = $1 FOR UPDATE', [bedId]);
      if (bedRes.rows.length === 0 || bedRes.rows[0].status !== 'vacant') {
        throw new Error('Selected bed is no longer vacant');
      }

      // Check student existing active allocation
      const existingAlloc = await query('SELECT id FROM student_allocations WHERE student_id = $1 AND status = \'active\'', [studentId]);
      if (existingAlloc.rows.length > 0) {
        throw new Error('Student already has an active room allocation. Please use room transfer instead.');
      }

      const allocId = uuidv4();
      await query(
        `INSERT INTO student_allocations (id, student_id, hostel_id, room_id, bed_id, academic_year_id, check_in_date, status, created_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9)`,
        [allocId, studentId, hostelId, roomId, bedId, academicYearId || null, checkInDate, req.user?.id, notes || null]
      );

      await query("UPDATE beds SET status = 'occupied' WHERE id = $1", [bedId]);
      await query("UPDATE rooms SET current_occupancy = current_occupancy + 1 WHERE id = $1", [roomId]);
    });

    await logAudit(req.user?.id, 'ALLOCATE_BED', 'student_allocation', studentId, { bedId, roomId, hostelId }, req);

    res.json({ success: true, message: 'Bed allocated successfully to student' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function transferRoom(req: AuthRequest, res: Response): Promise<void> {
  const { studentId, toHostelId, toRoomId, toBedId, reason } = req.body;

  if (!studentId || !toHostelId || !toRoomId || !toBedId || !reason) {
    res.status(400).json({ success: false, error: 'All transfer details and justification reason are required' });
    return;
  }

  if (req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
    if (!req.user.assignedHostels.includes(toHostelId)) {
      res.status(403).json({ success: false, error: 'Cannot transfer student to a hostel outside your assigned wing' });
      return;
    }
  }

  try {
    await executeTransaction(async (query) => {
      // Find current active allocation
      const currentAllocRes = await query('SELECT * FROM student_allocations WHERE student_id = $1 AND status = \'active\'', [studentId]);
      if (currentAllocRes.rows.length === 0) {
        throw new Error('Student has no active room allocation to transfer');
      }
      const cur = currentAllocRes.rows[0];

      // Check target bed
      const targetBedRes = await query('SELECT status FROM beds WHERE id = $1', [toBedId]);
      if (targetBedRes.rows.length === 0 || targetBedRes.rows[0].status !== 'vacant') {
        throw new Error('Target bed is not vacant');
      }

      // Close old allocation
      await query("UPDATE student_allocations SET status = 'transferred', check_out_date = CURRENT_DATE WHERE id = $1", [cur.id]);
      await query("UPDATE beds SET status = 'vacant' WHERE id = $1", [cur.bed_id]);
      await query("UPDATE rooms SET current_occupancy = GREATEST(0, current_occupancy - 1) WHERE id = $1", [cur.room_id]);

      // Create new allocation
      const newAllocId = uuidv4();
      await query(
        `INSERT INTO student_allocations (id, student_id, hostel_id, room_id, bed_id, academic_year_id, check_in_date, status, created_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, 'active', $7, $8)`,
        [newAllocId, studentId, toHostelId, toRoomId, toBedId, cur.academic_year_id, req.user?.id, `Transferred: ${reason}`]
      );
      await query("UPDATE beds SET status = 'occupied' WHERE id = $1", [toBedId]);
      await query("UPDATE rooms SET current_occupancy = current_occupancy + 1 WHERE id = $1", [toRoomId]);

      // Record in allocation history
      const historyId = uuidv4();
      const transferType = cur.hostel_id === toHostelId ? 'room_transfer' : 'hostel_transfer';
      await query(
        `INSERT INTO allocation_history (id, student_id, from_hostel_id, to_hostel_id, from_room_id, to_room_id, from_bed_id, to_bed_id, transfer_type, reason, approved_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [historyId, studentId, cur.hostel_id, toHostelId, cur.room_id, toRoomId, cur.bed_id, toBedId, transferType, reason, req.user?.id]
      );
    });

    await logAudit(req.user?.id, 'TRANSFER_ROOM', 'student', studentId, { toHostelId, toRoomId, toBedId, reason }, req);

    res.json({ success: true, message: 'Student room transfer completed successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function createHostel(req: AuthRequest, res: Response): Promise<void> {
  const {
    name,
    code,
    category,
    campus = 'Main Campus, Rajahmundry',
    chiefWardenId,
    wardenId,
    initRooms,
    autoGenRooms,
    numFloors: rawNumFloors,
    roomsPerFloor: rawRoomsPerFloor,
    bedsPerRoom: rawBedsPerRoom,
    blockName: rawBlockName
  } = req.body;

  if (!name || !code || !category) {
    res.status(400).json({ success: false, error: 'Hostel name, code, and category (boys/girls) are required' });
    return;
  }

  const cleanCode = String(code).trim().toUpperCase();
  const cleanCategory = String(category).trim().toLowerCase();
  if (!['boys', 'girls'].includes(cleanCategory)) {
    res.status(400).json({ success: false, error: 'Category must be either "boys" or "girls"' });
    return;
  }

  // Enforce wing restriction on hostel creation
  if (req.user?.role !== 'super_admin' && req.user?.assignedCategory && req.user.assignedCategory !== 'all') {
    if (cleanCategory !== req.user.assignedCategory) {
      res.status(403).json({
        success: false,
        error: `Access Denied: You are in the ${req.user.assignedCategory.toUpperCase()} wing and cannot create a ${cleanCategory} hostel.`
      });
      return;
    }
  }

  try {
    const existing = await executeQuery('SELECT id FROM hostels WHERE code = $1', [cleanCode]);
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, error: `Hostel with code "${cleanCode}" already exists` });
      return;
    }

    const hostelId = `hostel-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    await executeTransaction(async (query) => {
      // 1. Insert Hostel
      await query(
        `INSERT INTO hostels (id, name, code, category, campus, total_capacity, status, chief_warden_id)
         VALUES ($1, $2, $3, $4, $5, 0, 'active', $6)`,
        [hostelId, name.trim(), cleanCode, cleanCategory, campus.trim(), chiefWardenId || null]
      );

      // 2. Assign Chief Warden & Warden
      if (chiefWardenId) {
        await query(
          `INSERT INTO user_hostel_assignments (id, user_id, hostel_id)
           VALUES ($1, $2, $3) ON CONFLICT (user_id, hostel_id) DO NOTHING`,
          [`uha-cw-${hostelId}`, chiefWardenId, hostelId]
        );
      }
      if (wardenId) {
        await query(
          `INSERT INTO user_hostel_assignments (id, user_id, hostel_id)
           VALUES ($1, $2, $3) ON CONFLICT (user_id, hostel_id) DO NOTHING`,
          [`uha-w-${hostelId}`, wardenId, hostelId]
        );
      }

      // 3. Optional: Initial Rooms / Beds generation
      const shouldGenRooms = autoGenRooms !== false && (
        Boolean(initRooms && (initRooms.numFloors || initRooms.roomsPerFloor)) ||
        Boolean(rawNumFloors || rawRoomsPerFloor)
      );

      if (shouldGenRooms) {
        const numFloors = Math.min(10, Math.max(1, parseInt(String(initRooms?.numFloors || rawNumFloors)) || 3));
        const roomsPerFloor = Math.min(50, Math.max(1, parseInt(String(initRooms?.roomsPerFloor || rawRoomsPerFloor)) || 10));
        const bedsPerRoom = Math.min(10, Math.max(1, parseInt(String(initRooms?.bedsPerRoom || rawBedsPerRoom)) || 3));
        const blockCode = 'A';
        const blockName = (initRooms?.blockName || rawBlockName)?.trim() || 'Main Wing';
        const blockId = `blk-${hostelId}-${blockCode.toLowerCase()}`;

        await query(
          `INSERT INTO blocks (id, hostel_id, name, code) VALUES ($1, $2, $3, $4)`,
          [blockId, hostelId, blockName, blockCode]
        );

        let totalBedsCount = 0;
        for (let f = 1; f <= numFloors; f++) {
          const floorId = `flr-${blockId}-${f}`;
          const floorName = f === 1 ? 'First Floor' : f === 2 ? 'Second Floor' : f === 3 ? 'Third Floor' : `Floor ${f}`;
          await query(
            `INSERT INTO floors (id, block_id, floor_number, name) VALUES ($1, $2, $3, $4)`,
            [floorId, blockId, f, floorName]
          );

          for (let r = 1; r <= roomsPerFloor; r++) {
            const roomNumber = `${f}${r.toString().padStart(2, '0')}`;
            const roomId = `rm-${hostelId}-${roomNumber}`;
            const roomType = bedsPerRoom === 1 ? 'single' : bedsPerRoom === 2 ? 'double' : bedsPerRoom === 3 ? 'triple' : 'four_share';

            await query(
              `INSERT INTO rooms (id, floor_id, hostel_id, room_number, room_type, capacity, current_occupancy)
               VALUES ($1, $2, $3, $4, $5, $6, 0)`,
              [roomId, floorId, hostelId, roomNumber, roomType, bedsPerRoom]
            );

            for (let b = 1; b <= bedsPerRoom; b++) {
              const bedId = `bed-${roomId}-${b}`;
              await query(
                `INSERT INTO beds (id, room_id, bed_number, status) VALUES ($1, $2, $3, 'vacant')`,
                [bedId, roomId, `Bed ${b}`]
              );
              totalBedsCount++;
            }
          }
        }

        // Update hostel total capacity
        await query(`UPDATE hostels SET total_capacity = $1 WHERE id = $2`, [totalBedsCount, hostelId]);
      }
    });

    await logAudit(req.user?.id, 'CREATE_HOSTEL', 'hostel', hostelId, { name, code: cleanCode, category: cleanCategory }, req);

    res.status(201).json({
      success: true,
      message: `Hostel "${name}" created successfully.`,
      data: { id: hostelId, name, code: cleanCode, category: cleanCategory }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteHostel(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const target = await executeQuery('SELECT category FROM hostels WHERE id = $1', [id]);
    if (target.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Hostel not found' });
      return;
    }

    if (req.user?.role !== 'super_admin' && req.user?.assignedCategory && req.user.assignedCategory !== 'all') {
      if (target.rows[0].category !== req.user.assignedCategory) {
        res.status(403).json({ success: false, error: 'Access denied: Cannot delete hostel from another wing' });
        return;
      }
    }

    const checkRes = await executeQuery(
      'SELECT id FROM student_allocations WHERE hostel_id = $1 AND status = \'active\'',
      [id]
    );
    if (checkRes.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Cannot delete hostel: active students are currently allocated to it.' });
      return;
    }

    await executeTransaction(async (query) => {
      await query('DELETE FROM mess_menus WHERE hostel_id = $1', [id]);
      await query('DELETE FROM mess_inventory_transactions WHERE inventory_item_id IN (SELECT id FROM mess_inventory WHERE hostel_id = $1)', [id]);
      await query('DELETE FROM mess_inventory WHERE hostel_id = $1', [id]);
      await query('DELETE FROM food_wastage_logs WHERE hostel_id = $1', [id]);
      await query('DELETE FROM beds WHERE room_id IN (SELECT id FROM rooms WHERE hostel_id = $1)', [id]);
      await query('DELETE FROM rooms WHERE hostel_id = $1', [id]);
      await query('DELETE FROM floors WHERE block_id IN (SELECT id FROM blocks WHERE hostel_id = $1)', [id]);
      await query('DELETE FROM blocks WHERE hostel_id = $1', [id]);
      await query('DELETE FROM user_hostel_assignments WHERE hostel_id = $1', [id]);
      await query('DELETE FROM hostels WHERE id = $1', [id]);
    });

    await logAudit(req.user?.id, 'DELETE_HOSTEL', 'hostel', id, {}, req);

    res.json({ success: true, message: 'Hostel deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateHostel(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, code, category, campus, chiefWardenId, wardenId } = req.body;

  if (!name || !code) {
    res.status(400).json({ success: false, error: 'Hostel Name and Code are required' });
    return;
  }

  const cleanCategory = String(category).trim().toLowerCase();
  if (!['boys', 'girls'].includes(cleanCategory)) {
    res.status(400).json({ success: false, error: 'Category must be either "boys" or "girls"' });
    return;
  }

  try {
    const target = await executeQuery('SELECT category FROM hostels WHERE id = $1', [id]);
    if (target.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Hostel not found' });
      return;
    }

    if (req.user?.role !== 'super_admin' && req.user?.assignedCategory && req.user.assignedCategory !== 'all') {
      if (target.rows[0].category !== req.user.assignedCategory || cleanCategory !== req.user.assignedCategory) {
        res.status(403).json({ success: false, error: 'Access denied: Cannot change hostel category to a different wing' });
        return;
      }
    }

    const existing = await executeQuery('SELECT id FROM hostels WHERE LOWER(code) = LOWER($1) AND id != $2', [code.trim(), id]);
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, error: `Another hostel with code "${code}" already exists` });
      return;
    }

    await executeTransaction(async (query) => {
      await query(
        `UPDATE hostels
         SET name = $1, code = $2, category = $3, campus = $4,
             chief_warden_id = COALESCE($5, chief_warden_id),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [name.trim(), code.trim().toUpperCase(), cleanCategory, (campus || '').trim(), chiefWardenId || null, id]
      );

      if (chiefWardenId) {
        await query('DELETE FROM user_hostel_assignments WHERE hostel_id = $1 AND role = $2', [id, 'chief_warden']);
        await query(
          `INSERT INTO user_hostel_assignments (id, user_id, hostel_id, role)
           VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, hostel_id) DO NOTHING`,
          [`uha-cw-${id}`, chiefWardenId, id, 'chief_warden']
        );
      }
      if (wardenId) {
        await query('DELETE FROM user_hostel_assignments WHERE hostel_id = $1 AND role = $2', [id, 'hostel_warden']);
        await query(
          `INSERT INTO user_hostel_assignments (id, user_id, hostel_id, role)
           VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, hostel_id) DO NOTHING`,
          [`uha-w-${id}`, wardenId, id, 'hostel_warden']
        );
      }
    });

    await logAudit(req.user?.id, 'UPDATE_HOSTEL', 'hostel', id, { name, code, category: cleanCategory }, req);

    res.json({ success: true, message: 'Hostel updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function addRoomToHostel(req: AuthRequest, res: Response): Promise<void> {
  const { id: hostelId } = req.params;
  const { roomNumber, floorNumber = 1, capacity = 2, roomType = 'double', blockCode = 'A', blockName = 'Main Wing' } = req.body;

  if (!roomNumber) {
    res.status(400).json({ success: false, error: 'Room number is required' });
    return;
  }

  try {
    await executeTransaction(async (query) => {
      let blockId = `blk-${hostelId}-${blockCode.toLowerCase()}`;
      const blockCheck = await query('SELECT id FROM blocks WHERE hostel_id = $1 AND code = $2', [hostelId, blockCode]);
      if (blockCheck.rows.length === 0) {
        await query('INSERT INTO blocks (id, hostel_id, name, code) VALUES ($1, $2, $3, $4)', [blockId, hostelId, blockName, blockCode]);
      } else {
        blockId = blockCheck.rows[0].id;
      }

      let floorId = `flr-${blockId}-${floorNumber}`;
      const floorCheck = await query('SELECT id FROM floors WHERE block_id = $1 AND floor_number = $2', [blockId, floorNumber]);
      if (floorCheck.rows.length === 0) {
        const floorTitle = floorNumber === 1 ? 'First Floor' : floorNumber === 2 ? 'Second Floor' : `Floor ${floorNumber}`;
        await query('INSERT INTO floors (id, block_id, floor_number, name) VALUES ($1, $2, $3, $4)', [floorId, blockId, floorNumber, floorTitle]);
      } else {
        floorId = floorCheck.rows[0].id;
      }

      const roomId = `rm-${hostelId}-${roomNumber.toString().trim()}`;
      const cap = parseInt(String(capacity)) || 2;
      await query(
        `INSERT INTO rooms (id, floor_id, hostel_id, room_number, room_type, capacity, current_occupancy)
         VALUES ($1, $2, $3, $4, $5, $6, 0)`,
        [roomId, floorId, hostelId, roomNumber.toString().trim(), roomType, cap]
      );

      for (let b = 1; b <= cap; b++) {
        await query(
          `INSERT INTO beds (id, room_id, bed_number, status) VALUES ($1, $2, $3, 'vacant')`,
          [`bed-${roomId}-${b}`, roomId, `Bed ${b}`]
        );
      }

      await query('UPDATE hostels SET total_capacity = total_capacity + $1 WHERE id = $2', [cap, hostelId]);
    });

    res.status(201).json({ success: true, message: `Room ${roomNumber} added with ${capacity} beds.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getUnallocatedCandidates(req: AuthRequest, res: Response): Promise<void> {
  const { gender, departmentId, courseId, yearOfStudy, search } = req.query;

  try {
    // 1. Determine wing / gender constraint
    let wingGender = gender && gender !== 'all' ? String(gender) : null;
    if (req.user?.assignedCategory && ['boys', 'girls'].includes(req.user.assignedCategory)) {
      wingGender = req.user.assignedCategory === 'boys' ? 'male' : 'female';
    }

    // 2. Base query for unallocated candidates in this wing
    let baseSql = `
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.hostel_status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM student_allocations sa 
          WHERE sa.student_id = s.id AND sa.status = 'active'
        )
    `;
    const baseParams: any[] = [];
    if (wingGender) {
      baseParams.push(wingGender);
      baseSql += ` AND s.gender = $1`;
    }

    // Fetch distinct cohort values present strictly in the unallocated candidates
    const cohortRes = await executeQuery(`
      SELECT 
        s.department_id,
        COALESCE(d.name, 'General Studies') as department_name,
        COALESCE(d.code, 'GEN') as department_code,
        s.course_id,
        COALESCE(c.name, 'General Course') as course_name,
        COALESCE(c.code, 'GEN') as course_code,
        s.year_of_study,
        COUNT(s.id) as count
      ${baseSql}
      GROUP BY s.department_id, d.name, d.code, s.course_id, c.name, c.code, s.year_of_study
    `, baseParams);

    const deptMap = new Map<string, { id: string; name: string; code: string; count: number }>();
    const courseMap = new Map<string, { id: string; name: string; code: string; count: number }>();
    const yearMap = new Map<number, number>();
    let totalUnallocated = 0;

    for (const row of cohortRes.rows) {
      const cCount = parseInt(row.count, 10) || 0;
      totalUnallocated += cCount;

      if (row.department_id) {
        const existing = deptMap.get(row.department_id);
        if (existing) {
          existing.count += cCount;
        } else {
          deptMap.set(row.department_id, {
            id: row.department_id,
            name: row.department_name,
            code: row.department_code,
            count: cCount
          });
        }
      }

      if (row.course_id) {
        const existing = courseMap.get(row.course_id);
        if (existing) {
          existing.count += cCount;
        } else {
          courseMap.set(row.course_id, {
            id: row.course_id,
            name: row.course_name,
            code: row.course_code,
            count: cCount
          });
        }
      }

      const y = parseInt(row.year_of_study, 10);
      if (y && !isNaN(y)) {
        yearMap.set(y, (yearMap.get(y) || 0) + cCount);
      }
    }

    const availableDepartments = Array.from(deptMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const availableCourses = Array.from(courseMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const availableYears = Array.from(yearMap.entries())
      .map(([year, count]) => ({
        year,
        label: year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : year === 4 ? '4th Year' : `Year ${year}`,
        count
      }))
      .sort((a, b) => a.year - b.year);

    // 3. Query filtered candidates matching applied cohort filters
    let filterSql = `
      SELECT 
        s.id, s.student_id_code, s.roll_number, s.reg_number, s.full_name, s.gender,
        s.year_of_study, s.current_semester, s.phone, s.email,
        d.id as department_id, d.name as department_name, d.code as department_code,
        c.id as course_id, c.name as course_name, c.code as course_code
      ${baseSql}
    `;
    const filterParams: any[] = [...baseParams];

    if (departmentId && departmentId !== 'all') {
      filterParams.push(departmentId);
      filterSql += ` AND s.department_id = $${filterParams.length}`;
    }

    if (courseId && courseId !== 'all') {
      filterParams.push(courseId);
      filterSql += ` AND s.course_id = $${filterParams.length}`;
    }

    if (yearOfStudy && yearOfStudy !== 'all') {
      filterParams.push(parseInt(String(yearOfStudy)) || 1);
      filterSql += ` AND s.year_of_study = $${filterParams.length}`;
    }

    if (search) {
      filterParams.push(`%${String(search).trim()}%`);
      filterSql += ` AND (s.full_name ILIKE $${filterParams.length} OR s.roll_number ILIKE $${filterParams.length} OR s.reg_number ILIKE $${filterParams.length})`;
    }

    filterSql += ' ORDER BY s.year_of_study ASC, c.code ASC, s.roll_number ASC LIMIT 300';

    const result = await executeQuery(filterSql, filterParams);
    res.json({
      success: true,
      data: result.rows,
      totalCount: result.rows.length,
      availableFilters: {
        totalUnallocated,
        departments: availableDepartments,
        courses: availableCourses,
        years: availableYears
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function batchAllocateCohort(req: AuthRequest, res: Response): Promise<void> {
  const { targetHostelId, targetFloorId, targetRoomId, studentIds, notes } = req.body;

  if (!targetHostelId) {
    res.status(400).json({ success: false, error: 'Target hostel ID is required' });
    return;
  }

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    res.status(400).json({ success: false, error: 'At least one student must be selected for allocation' });
    return;
  }

  if (req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
    if (!req.user.assignedHostels.includes(targetHostelId)) {
      res.status(403).json({ success: false, error: 'Cannot allocate students to a hostel outside your assigned wing' });
      return;
    }
  }

  try {
    const hostelRes = await executeQuery('SELECT id, name, code, category FROM hostels WHERE id = $1', [targetHostelId]);
    if (hostelRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Target hostel not found' });
      return;
    }
    const hostel = hostelRes.rows[0];
    const expectedGender = hostel.category === 'girls' ? 'female' : 'male';

    const placeholders = studentIds.map((_, i) => `$${i + 1}`).join(',');
    const studentRes = await executeQuery(
      `SELECT s.id, s.roll_number, s.reg_number, s.full_name, s.gender,
              (SELECT sa.id FROM student_allocations sa WHERE sa.student_id = s.id AND sa.status = 'active' LIMIT 1) as active_alloc_id
       FROM students s
       WHERE s.id IN (${placeholders})
       ORDER BY s.year_of_study ASC, s.roll_number ASC`,
      studentIds
    );

    const validStudents: any[] = [];
    for (const stu of studentRes.rows) {
      if (stu.active_alloc_id) {
        continue;
      }
      if (stu.gender !== expectedGender) {
        res.status(400).json({
          success: false,
          error: `Gender mismatch: Student ${stu.full_name} (${stu.gender}) cannot be allocated to ${hostel.name} (${hostel.category} wing).`
        });
        return;
      }
      validStudents.push(stu);
    }

    if (validStudents.length === 0) {
      res.status(400).json({ success: false, error: 'All selected students already have active room allocations.' });
      return;
    }

    let bedSql = `
      SELECT b.id as bed_id, b.bed_number, r.id as room_id, r.room_number, r.capacity, r.current_occupancy,
             fl.id as floor_id, fl.floor_number, bl.id as block_id, bl.name as block_name
      FROM beds b
      JOIN rooms r ON b.room_id = r.id
      LEFT JOIN floors fl ON r.floor_id = fl.id
      LEFT JOIN blocks bl ON fl.block_id = bl.id
      WHERE r.hostel_id = $1
        AND b.status = 'vacant'
        AND r.status = 'active'
    `;
    const bedParams: any[] = [targetHostelId];

    if (targetFloorId && targetFloorId !== 'all') {
      bedParams.push(targetFloorId);
      bedSql += ` AND (fl.id = $${bedParams.length} OR fl.floor_number::text = $${bedParams.length})`;
    }

    if (targetRoomId && targetRoomId !== 'all') {
      bedParams.push(targetRoomId);
      bedSql += ` AND (r.id = $${bedParams.length} OR r.room_number = $${bedParams.length})`;
    }

    bedSql += ` ORDER BY bl.code ASC NULLS LAST, fl.floor_number ASC NULLS LAST, r.room_number ASC, b.bed_number ASC`;

    const vacantBedsRes = await executeQuery(bedSql, bedParams);
    const vacantBeds = vacantBedsRes.rows;

    if (vacantBeds.length === 0) {
      res.status(400).json({
        success: false,
        error: `No vacant beds available in ${hostel.name}${targetFloorId ? ' on the selected floor' : ''}.`
      });
      return;
    }

    const countToAllocate = Math.min(validStudents.length, vacantBeds.length);
    const allocatedPairs: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    await executeTransaction(async (query) => {
      const ayRes = await query('SELECT id FROM academic_years WHERE is_current = true LIMIT 1');
      const currentAyId = ayRes.rows[0]?.id || null;

      for (let i = 0; i < countToAllocate; i++) {
        const student = validStudents[i];
        const bed = vacantBeds[i];
        const allocId = uuidv4();

        const bedLock = await query('SELECT status FROM beds WHERE id = $1 FOR UPDATE', [bed.bed_id]);
        if (bedLock.rows[0]?.status !== 'vacant') {
          continue;
        }

        await query(
          `INSERT INTO student_allocations (id, student_id, hostel_id, room_id, bed_id, academic_year_id, check_in_date, status, created_by, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9)`,
          [allocId, student.id, targetHostelId, bed.room_id, bed.bed_id, currentAyId, today, req.user?.id || null, notes || 'Batch auto-allocation']
        );

        await query("UPDATE beds SET status = 'occupied' WHERE id = $1", [bed.bed_id]);
        await query("UPDATE rooms SET current_occupancy = current_occupancy + 1 WHERE id = $1", [bed.room_id]);

        allocatedPairs.push({
          studentId: student.id,
          studentName: student.full_name,
          rollNumber: student.roll_number,
          hostelName: hostel.name,
          roomNumber: bed.room_number,
          bedNumber: bed.bed_number,
          floorNumber: bed.floor_number
        });
      }
    });

    await logAudit(req.user?.id, 'BATCH_ALLOCATE_STUDENTS', 'student_allocation', targetHostelId, {
      allocatedCount: allocatedPairs.length,
      requestedCount: validStudents.length,
      hostelName: hostel.name
    }, req);

    const summaryData = {
      allocatedCount: allocatedPairs.length,
      remainingUnallocated: validStudents.length - allocatedPairs.length,
      allocatedPairs
    };

    res.json({
      success: true,
      message: `Successfully allocated ${allocatedPairs.length} students to ${hostel.name}.`,
      data: summaryData,
      summary: summaryData
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function batchVacateStudents(req: AuthRequest, res: Response): Promise<void> {
  const { studentIds, reason = 'Batch checkout' } = req.body;

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    res.status(400).json({ success: false, error: 'Student IDs array is required' });
    return;
  }

  try {
    let vacatedCount = 0;
    await executeTransaction(async (query) => {
      const placeholders = studentIds.map((_, i) => `$${i + 1}`).join(',');
      const allocs = await query(
        `SELECT sa.id, sa.student_id, sa.room_id, sa.bed_id, sa.hostel_id
         FROM student_allocations sa
         WHERE sa.student_id IN (${placeholders}) AND sa.status = 'active'`,
        studentIds
      );

      for (const a of allocs.rows) {
        await query(
          `UPDATE student_allocations SET status = 'checked_out', check_out_date = CURRENT_DATE WHERE id = $1`,
          [a.id]
        );
        await query(`UPDATE beds SET status = 'vacant' WHERE id = $1`, [a.bed_id]);
        await query(`UPDATE rooms SET current_occupancy = GREATEST(0, current_occupancy - 1) WHERE id = $1`, [a.room_id]);
        vacatedCount++;
      }
    });

    await logAudit(req.user?.id, 'BATCH_VACATE_STUDENTS', 'student_allocation', undefined, { vacatedCount, reason }, req);

    res.json({
      success: true,
      message: `Successfully vacated ${vacatedCount} student allocations.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteBed(req: AuthRequest, res: Response): Promise<void> {
  const { bedId } = req.params;

  try {
    const bedRes = await executeQuery(
      `SELECT b.id, b.room_id, b.bed_number, b.status, r.hostel_id, r.room_number, h.name as hostel_name
       FROM beds b
       JOIN rooms r ON b.room_id = r.id
       JOIN hostels h ON r.hostel_id = h.id
       WHERE b.id = $1`,
      [bedId]
    );

    if (bedRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Bed not found' });
      return;
    }

    const bed = bedRes.rows[0];

    // RBAC check: restrict wardens to their assigned hostels
    if (req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
      if (!req.user.assignedHostels.includes(bed.hostel_id)) {
        res.status(403).json({ success: false, error: 'Cannot delete beds outside your assigned hostel wing' });
        return;
      }
    }

    // Check if bed is currently occupied by an active allocation
    const allocRes = await executeQuery(
      `SELECT sa.id, s.full_name, s.roll_number 
       FROM student_allocations sa
       JOIN students s ON sa.student_id = s.id
       WHERE sa.bed_id = $1 AND sa.status = 'active'`,
      [bedId]
    );

    if (allocRes.rows.length > 0 || bed.status === 'occupied') {
      const studentName = allocRes.rows[0]?.full_name || 'a resident';
      res.status(400).json({
        success: false,
        error: `Cannot delete ${bed.bed_number} because it is currently occupied by ${studentName}. Please vacate the resident before deleting the bed.`
      });
      return;
    }

    await executeTransaction(async (query) => {
      // 1. Delete the bed
      await query('DELETE FROM beds WHERE id = $1', [bedId]);

      // 2. Update room capacity and occupancy
      await query(
        `UPDATE rooms 
         SET capacity = (SELECT COUNT(*) FROM beds WHERE room_id = $1),
             current_occupancy = (SELECT COUNT(*) FROM beds WHERE room_id = $1 AND status = 'occupied')
         WHERE id = $1`,
        [bed.room_id]
      );

      // 3. Update hostel total capacity
      await query(
        `UPDATE hostels 
         SET total_capacity = (
           SELECT COUNT(b.id) 
           FROM beds b 
           JOIN rooms r ON b.room_id = r.id 
           WHERE r.hostel_id = $1
         )
         WHERE id = $1`,
        [bed.hostel_id]
      );
    });

    await logAudit(
      req.user?.id || 'system',
      'DELETE_BED',
      'bed',
      bedId,
      { hostelId: bed.hostel_id, roomId: bed.room_id, bedNumber: bed.bed_number },
      req
    );

    res.json({
      success: true,
      message: `Successfully deleted ${bed.bed_number} from Room ${bed.room_number}.`
    });
  } catch (err: any) {
    console.error('Error deleting bed:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to delete bed' });
  }
}

export async function addBedToRoom(req: AuthRequest, res: Response): Promise<void> {
  const { roomId } = req.params;
  const { bedNumber } = req.body;

  try {
    const roomRes = await executeQuery(
      `SELECT r.id, r.room_number, r.hostel_id, h.name as hostel_name
       FROM rooms r
       JOIN hostels h ON r.hostel_id = h.id
       WHERE r.id = $1`,
      [roomId]
    );

    if (roomRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }

    const room = roomRes.rows[0];

    // RBAC check
    if (req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
      if (!req.user.assignedHostels.includes(room.hostel_id)) {
        res.status(403).json({ success: false, error: 'Cannot add beds to a hostel outside your assigned wing' });
        return;
      }
    }

    const existingBedsRes = await executeQuery('SELECT bed_number FROM beds WHERE room_id = $1', [roomId]);
    const existingNames = new Set(existingBedsRes.rows.map((b: any) => b.bed_number.toLowerCase().trim()));

    let finalBedNumber = (bedNumber && bedNumber.trim()) || '';
    if (finalBedNumber && existingNames.has(finalBedNumber.toLowerCase())) {
      res.status(400).json({
        success: false,
        error: `A bed named "${finalBedNumber}" already exists in Room ${room.room_number}. Please choose a different label.`
      });
      return;
    }

    if (!finalBedNumber) {
      // Find the first unused sequence number (Bed 1, Bed 2, Bed 3, ...)
      let i = 1;
      while (existingNames.has(`bed ${i}`)) {
        i++;
      }
      finalBedNumber = `Bed ${i}`;
    }

    const bedId = `bed-${roomId}-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    await executeTransaction(async (query) => {
      await query(
        `INSERT INTO beds (id, room_id, bed_number, status) VALUES ($1, $2, $3, 'vacant')`,
        [bedId, roomId, finalBedNumber]
      );

      await query(
        `UPDATE rooms SET capacity = (SELECT COUNT(*) FROM beds WHERE room_id = $1) WHERE id = $1`,
        [roomId]
      );

      await query(
        `UPDATE hostels SET total_capacity = (SELECT COUNT(b.id) FROM beds b JOIN rooms r ON b.room_id = r.id WHERE r.hostel_id = $1) WHERE id = $1`,
        [room.hostel_id]
      );
    });

    await logAudit(
      req.user?.id || 'system',
      'ADD_BED',
      'bed',
      bedId,
      { hostelId: room.hostel_id, roomId, bedNumber: finalBedNumber },
      req
    );

    res.json({
      success: true,
      message: `Successfully added ${finalBedNumber} to Room ${room.room_number}.`,
      data: { id: bedId, roomId, bedNumber: finalBedNumber, status: 'vacant' }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to add bed' });
  }
}

