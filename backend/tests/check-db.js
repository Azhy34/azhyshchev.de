const dotenv = require('dotenv');
const path = require('path');
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

async function run() {
  try {
    const url = `${supabaseUrl}/rest/v1/`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      console.error(`Status ${response.status}:`, await response.text());
      return;
    }

    const data = await response.json();
    console.log("Supabase Tables & Paths:");
    console.log(Object.keys(data.paths));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
