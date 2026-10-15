import { executeQuery } from '../config/database.js';

async function updateMealSessions() {
  try {
    const sessions = [
      { id: 'ms-breakfast', name: 'Morning Breakfast', code: 'breakfast', startTime: '07:00', endTime: '10:00', grace: 0, is_active: true },
      { id: 'ms-lunch', name: 'Afternoon Lunch', code: 'lunch', startTime: '12:00', endTime: '15:00', grace: 0, is_active: true },
      { id: 'ms-snacks', name: 'Evening Snacks (Optional)', code: 'snacks', startTime: '16:30', endTime: '18:00', grace: 0, is_active: true },
      { id: 'ms-dinner', name: 'Night Dinner', code: 'dinner', startTime: '19:00', endTime: '22:30', grace: 0, is_active: true }
    ];

    for (const s of sessions) {
      await executeQuery(
        `INSERT INTO meal_sessions (id, name, code, start_time, end_time, grace_minutes, is_active, allow_correction)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           code = EXCLUDED.code,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           grace_minutes = EXCLUDED.grace_minutes,
           is_active = EXCLUDED.is_active`,
        [s.id, s.name, s.code, s.startTime, s.endTime, s.grace, s.is_active]
      );
    }

    const res = await executeQuery('SELECT * FROM meal_sessions ORDER BY start_time ASC');
    console.log('Updated meal sessions:', res.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error updating meal sessions:', err);
    process.exit(1);
  }
}

updateMealSessions();
