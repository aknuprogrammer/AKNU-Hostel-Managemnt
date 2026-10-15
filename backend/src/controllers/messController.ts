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
