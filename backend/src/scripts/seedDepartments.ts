async function getAdminToken(): Promise<string> {
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@aknu.edu.in', password: 'Aknu@2026!' })
  });
  const data = await loginRes.json();
  if (!data.token) {
    throw new Error('Could not authenticate: ' + (data.error || 'Server error'));
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

async function run() {
  const token = await getAdminToken();

  const depts = [
    ['dept-cse', 'CSE', 'Computer Science & Engineering'],
    ['dept-ece', 'ECE', 'Electronics & Communication Engineering'],
    ['dept-mech', 'MECH', 'Mechanical Engineering'],
    ['dept-civil', 'CIVIL', 'Civil Engineering'],
    ['dept-eee', 'EEE', 'Electrical & Electronics Engineering'],
    ['dept-it', 'IT', 'Information Technology'],
    ['dept-aids', 'AI-DS', 'Artificial Intelligence & Data Science'],
    ['dept-mba', 'MBA', 'Department of Management Studies'],
    ['dept-comm', 'COMM', 'Commerce & Accountancy'],
    ['dept-chem', 'CHEM', 'Chemistry'],
    ['dept-phys', 'PHYS', 'Physics'],
    ['dept-math', 'MATH', 'Mathematics'],
    ['dept-biotech', 'BIOTECH', 'Biotechnology'],
    ['dept-pharm', 'PHARM', 'Pharmaceutical Sciences'],
    ['dept-eng', 'ENG', 'English & Humanities'],
    ['dept-econ', 'ECON', 'Economics']
  ];

  for (const [id, code, name] of depts) {
    await runQueryViaApi(
      `INSERT INTO departments (id, code, name) VALUES ('${id}', '${code}', '${name}') ON CONFLICT (id) DO UPDATE SET name = '${name}', code = '${code}'`,
      token
    );
  }

  console.log('Successfully seeded all departments on live server!');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
