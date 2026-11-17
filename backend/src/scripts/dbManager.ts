import readline from 'readline';

async function getAdminToken(): Promise<string> {
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@aknu.edu.in', password: 'Aknu@2026!' })
  });
  const data = await loginRes.json();
  if (!data.token) {
    throw new Error('Could not authenticate as admin: ' + (data.error || 'Server unreachable'));
  }
  return data.token;
}

async function runQueryViaApi(sql: string, token: string): Promise<any> {
  const res = await fetch('http://localhost:5000/api/v1/dashboard/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ sql })
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error);
  }
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'stats';

  let token = '';
  try {
    token = await getAdminToken();
  } catch (err: any) {
    console.error(`[Error] Server must be running on http://localhost:5000: ${err.message}`);
    process.exit(1);
  }

  if (command === 'shell' || command === 'cli') {
    console.log('========================================================');
    console.log(' AKNU Hostel Management — Interactive Database Shell');
    console.log(' Type any SQL statement (e.g. SELECT * FROM students;)');
    console.log(' Type exit or quit to close.');
    console.log('========================================================\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'aknu_db=# '
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        rl.prompt();
        return;
      }
      if (['exit', 'quit', '\\q'].includes(trimmed.toLowerCase())) {
        rl.close();
        return;
      }

      try {
        const res = await runQueryViaApi(trimmed, token);
        if (res.rows && res.rows.length > 0) {
          console.table(res.rows);
          console.log(`(${res.rowCount} row${res.rowCount === 1 ? '' : 's'})\n`);
        } else {
          console.log(`Query OK. (${res.rowCount || 0} rows affected)\n`);
        }
      } catch (err: any) {
        console.error(`ERROR: ${err.message}\n`);
      }
      rl.prompt();
    });

    rl.on('close', () => {
      console.log('\nExiting database shell.');
      process.exit(0);
    });
    return;
  }

  if (command === 'stats') {
    console.log('========================================================');
    console.log(' AKNU Hostel Management System — Database Summary');
    console.log('========================================================\n');

    const tables = [
      'users', 'roles', 'hostels', 'blocks', 'floors', 'rooms', 'beds',
      'students', 'student_allocations', 'meal_sessions', 'meal_transactions',
      'scan_attempts', 'leave_applications', 'gate_passes', 'complaints',
      'mess_menus', 'mess_inventory', 'student_fee_ledgers', 'visitors', 'audit_logs'
    ];

    console.log('Table Record Counts:');
    for (const t of tables) {
      try {
        const res = await runQueryViaApi(`SELECT COUNT(*) as c FROM ${t}`, token);
        const count = res.rows[0].c;
        console.log(`  • ${t.padEnd(25)} : ${count}`);
      } catch (e: any) {
        console.log(`  • ${t.padEnd(25)} : [Error: ${e.message}]`);
      }
    }

    console.log('\nQuick Metric Summary:');
    try {
      const students = await runQueryViaApi('SELECT COUNT(*) as c FROM students', token);
      const beds = await runQueryViaApi(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
               COUNT(CASE WHEN status = 'vacant' THEN 1 END) as vacant
        FROM beds
      `, token);
      const meals = await runQueryViaApi('SELECT COUNT(*) as c FROM meal_transactions', token);

      console.log(`  Total Registered Students : ${students.rows[0].c}`);
      console.log(`  Total Hostel Beds         : ${beds.rows[0].total} (${beds.rows[0].occupied} occupied, ${beds.rows[0].vacant} vacant)`);
      console.log(`  Total Meals Recorded      : ${meals.rows[0].c}`);
    } catch (e) {}

    console.log('\n========================================================');
    return;
  }

  if (command === 'query') {
    const sql = args.slice(1).join(' ');
    if (!sql) {
      console.error('Usage: npm run db:query "SELECT * FROM students LIMIT 5;"');
      process.exit(1);
    }

    console.log(`\nExecuting SQL: ${sql}\n`);
    try {
      const res = await runQueryViaApi(sql, token);
      console.table(res.rows);
      console.log(`\nReturned ${res.rowCount} rows.`);
    } catch (err: any) {
      console.error('SQL Execution Error:', err.message);
    }
    return;
  }

  console.log(`Unknown command: ${command}`);
  console.log('Available commands:');
  console.log('  npm run db:stats');
  console.log('  npm run db:shell');
  console.log('  npm run db:query "<SQL_QUERY>"');
  return;
}

main();
