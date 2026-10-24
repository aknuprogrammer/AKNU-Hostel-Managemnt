import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, executeTransaction } from '../config/database.js';
import { AuthRequest, logAudit } from '../middleware/auth.js';

export const RECORD_ONLY_ROLES: string[] = [];

export async function getStaffList(req: AuthRequest, res: Response): Promise<void> {
  try {
    const isSuperAdmin = req.user?.role === 'super_admin';
    const wing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;

    let whereSql = "WHERE u.role NOT IN ('student', 'super_admin')";
    const params: any[] = [];
    if (wing) {
      whereSql += ` AND (u.gender_wing = $1 OR u.gender_wing = 'all')`;
      params.push(wing);
    }

    const result = await executeQuery(`
      SELECT u.id, u.email, u.full_name, u.phone, u.role, u.is_active, u.created_at, u.gender_wing,
             r.display_name as role_display,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT('id', h.id, 'name', h.name, 'code', h.code, 'category', h.category)
               ) FILTER (WHERE h.id IS NOT NULL),
               '[]'
             ) as assigned_hostels
      FROM users u
      JOIN roles r ON u.role = r.id
      LEFT JOIN user_hostel_assignments uha ON u.id = uha.user_id
      LEFT JOIN hostels h ON uha.hostel_id = h.id
      ${whereSql}
      GROUP BY u.id, u.email, u.full_name, u.phone, u.role, u.is_active, u.created_at, u.gender_wing, r.display_name
      ORDER BY u.full_name ASC
    `, params);

    const staffWithAccessFlag = result.rows.map((row: any) => {
      let assignedHostels: any[] = [];
      try {
        assignedHostels = typeof row.assigned_hostels === 'string'
          ? JSON.parse(row.assigned_hostels)
          : (row.assigned_hostels || []);
      } catch {
        assignedHostels = [];
      }

      const hostelNames = assignedHostels.map((h: any) => h.name).join(', ');
      const hostelCodes = assignedHostels.map((h: any) => h.code).join(', ');
      const hostelIds = assignedHostels.map((h: any) => h.id);

      return {
        ...row,
        assigned_hostels: assignedHostels,
        hostel_ids: hostelIds,
        hostel_id: assignedHostels[0]?.id || null,
        hostel_name: hostelNames || null,
        hostel_code: hostelCodes || null,
        isRecordOnly: false,
        accessType: 'Active System Access'
      };
    });

    res.json({ success: true, data: staffWithAccessFlag });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function addStaffRecord(req: AuthRequest, res: Response): Promise<void> {
  const { fullName, role, email, phone, hostelId, hostelIds } = req.body;

  if (!fullName || !role) {
    res.status(400).json({ success: false, error: 'Full name and role are required' });
    return;
  }

  const targetHostelIds: string[] = Array.isArray(hostelIds)
    ? hostelIds.filter(Boolean)
    : (hostelId ? [hostelId].filter(Boolean) : []);

  let staffEmail: string;
  if (email && email.trim() !== '') {
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      res.status(400).json({
        success: false,
        error: 'Please enter a valid email address (e.g. name@gmail.com or name@aknu.edu.in)'
      });
      return;
    }
    staffEmail = trimmed;
  } else {
    staffEmail = `staff.${Date.now().toString().slice(-6)}@aknu.edu.in`;
  }

  try {
    // Check if email already exists
    const existing = await executeQuery('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [staffEmail]);
    if (existing.rowCount > 0) {
      res.status(400).json({ success: false, error: 'A staff member with this email address already exists' });
      return;
    }

    const newId = `usr-${uuidv4().slice(0, 8)}`;
    const defaultHash = await bcrypt.hash('Aknu@2026!', 10);

    await executeTransaction(async (query) => {
      let staffWing = 'all';
      if (targetHostelIds.length > 0) {
        const hRes = await query('SELECT category FROM hostels WHERE id = ANY($1)', [targetHostelIds]);
        const categories = hRes.rows.map((r: any) => r.category);
        const allBoys = categories.length > 0 && categories.every((c: string) => c === 'boys');
        const allGirls = categories.length > 0 && categories.every((c: string) => c === 'girls');
        if (allBoys) staffWing = 'boys';
        else if (allGirls) staffWing = 'girls';
        else staffWing = 'all';
      } else if (req.user?.assignedCategory && req.user.assignedCategory !== 'all') {
        staffWing = req.user.assignedCategory;
      }

      await query(
        `INSERT INTO users (id, email, password_hash, full_name, phone, role, gender_wing, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [newId, staffEmail, defaultHash, fullName.trim(), phone || null, role, staffWing]
      );

      for (const hId of targetHostelIds) {
        await query(
          `INSERT INTO user_hostel_assignments (id, user_id, hostel_id, role)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, hostel_id) DO NOTHING`,
          [`uha-${uuidv4().slice(0, 8)}`, newId, hId, role]
        );

        if (role === 'chief_warden') {
          await query('UPDATE hostels SET chief_warden_id = $1 WHERE id = $2', [newId, hId]);
        }
      }
    });

    if (req.user) {
      await logAudit(
        req.user.id,
        'ADD_STAFF_RECORD',
        'users',
        newId,
        `Added ${role} staff record for ${fullName} with ${targetHostelIds.length} hostel assignments`,
        req
      );
    }

    res.status(201).json({
      success: true,
      message: 'Staff record added successfully to the university roster',
      data: {
        id: newId,
        fullName,
        role,
        email: staffEmail,
        hostelIds: targetHostelIds,
        isRecordOnly: RECORD_ONLY_ROLES.includes(role)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteStaffRecord(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const userRes = await executeQuery('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Staff member not found' });
      return;
    }

    if (userRes.rows[0].role === 'super_admin') {
      res.status(403).json({ success: false, error: 'Super Administrator record cannot be deleted' });
      return;
    }

    await executeTransaction(async (query) => {
      await query('DELETE FROM user_hostel_assignments WHERE user_id = $1', [id]);
      await query('UPDATE hostels SET chief_warden_id = NULL WHERE chief_warden_id = $1', [id]);
      await query('DELETE FROM users WHERE id = $1', [id]);
    });

    if (req.user) {
      await logAudit(
        req.user.id,
        'DELETE_STAFF_RECORD',
        'users',
        id,
        `Deleted staff record ${userRes.rows[0].full_name}`,
        req
      );
    }

    res.json({ success: true, message: 'Staff record removed from university roster' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateStaffRecord(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { fullName, role, email, phone, hostelId, hostelIds, isActive } = req.body;
  const hasHostelUpdate = hostelIds !== undefined || hostelId !== undefined;
  const targetHostelIds: string[] = Array.isArray(hostelIds)
    ? hostelIds.filter(Boolean)
    : (hostelId !== undefined ? (hostelId ? [hostelId].filter(Boolean) : []) : []);

  try {
    const existing = await executeQuery('SELECT * FROM users WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Staff member not found' });
      return;
    }

    if (existing.rows[0].role === 'super_admin') {
      res.status(403).json({ success: false, error: 'Super Administrator cannot be modified here' });
      return;
    }

    // Check email format & uniqueness if email is changed
    if (email && email.toLowerCase() !== (existing.rows[0].email || '').toLowerCase()) {
      const trimmed = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        res.status(400).json({
          success: false,
          error: 'Please enter a valid email address (e.g. name@gmail.com or name@aknu.edu.in)'
        });
        return;
      }

      const emailCheck = await executeQuery(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2',
        [trimmed, id]
      );
      if (emailCheck.rowCount > 0) {
        res.status(400).json({ success: false, error: 'Email address is already in use by another user' });
        return;
      }
    }

    await executeTransaction(async (query) => {
      let staffWingUpdate = null;
      if (hasHostelUpdate) {
        if (targetHostelIds.length > 0) {
          const hRes = await query('SELECT category FROM hostels WHERE id = ANY($1)', [targetHostelIds]);
          const categories = hRes.rows.map((r: any) => r.category);
          const allBoys = categories.length > 0 && categories.every((c: string) => c === 'boys');
          const allGirls = categories.length > 0 && categories.every((c: string) => c === 'girls');
          if (allBoys) staffWingUpdate = 'boys';
          else if (allGirls) staffWingUpdate = 'girls';
          else staffWingUpdate = 'all';
        } else {
          staffWingUpdate = 'all';
        }
      }

      await query(
        `UPDATE users SET
          full_name = COALESCE($1, full_name),
          role = COALESCE($2, role),
          email = COALESCE($3, email),
          phone = COALESCE($4, phone),
          is_active = COALESCE($5, is_active),
          gender_wing = COALESCE($6, gender_wing),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7`,
        [
          fullName ? fullName.trim() : null,
          role || null,
          email ? email.trim().toLowerCase() : null,
          phone !== undefined ? (phone ? phone.trim() : null) : null,
          typeof isActive === 'boolean' ? isActive : null,
          staffWingUpdate,
          id
        ]
      );

      if (hasHostelUpdate) {
        await query('DELETE FROM user_hostel_assignments WHERE user_id = $1', [id]);
        const finalRole = role || existing.rows[0].role;

        for (const hId of targetHostelIds) {
          await query(
            `INSERT INTO user_hostel_assignments (id, user_id, hostel_id, role) VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, hostel_id) DO NOTHING`,
            [`uha-${uuidv4().slice(0, 8)}`, id, hId, finalRole]
          );
        }

        if (finalRole === 'chief_warden') {
          if (targetHostelIds.length > 0) {
            await query('UPDATE hostels SET chief_warden_id = $1 WHERE id = ANY($2)', [id, targetHostelIds]);
            await query('UPDATE hostels SET chief_warden_id = NULL WHERE chief_warden_id = $1 AND NOT (id = ANY($2))', [id, targetHostelIds]);
          } else {
            await query('UPDATE hostels SET chief_warden_id = NULL WHERE chief_warden_id = $1', [id]);
          }
        }
      }
    });

    if (req.user) {
      await logAudit(
        req.user.id,
        'UPDATE_STAFF_RECORD',
        'users',
        id,
        `Updated staff record for ${fullName || existing.rows[0].full_name}`,
        req
      );
    }

    res.json({ success: true, message: 'Staff record updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update staff: ' + err.message });
  }
}

