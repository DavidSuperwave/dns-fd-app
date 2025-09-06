// Test specific plan ID with different API approaches
const WHOP_API_KEY = 'Uo7gzvenzpQFoEnLQry6b4Cn_tbR9ISOaaqw1hTSejc';
const PLAN_ID = 'plan_KmHruy3fDVOtP';
const PRODUCT_ID = 'prod_gBkccTFAkZwYi';

async function testSpecificPlan() {
  console.log(`🔍 Testing plan: ${PLAN_ID}\n`);

  // Method 1: Direct plan access
  console.log('1️⃣ Testing direct plan access...');
  try {
    const response = await fetch(`https://api.whop.com/api/v5/company/plans/${PLAN_ID}`, {
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Status:', response.status);
    const data = await response.text();
    console.log('Response:', data);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Method 2: List all plans from product
  console.log('\n2️⃣ Listing plans from product...');
  try {
    const response = await fetch(`https://api.whop.com/api/v5/company/products/${PRODUCT_ID}/plans`, {
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Status:', response.status);
    const data = await response.text();
    console.log('Response:', data);
    
    if (response.ok) {
      try {
        const parsed = JSON.parse(data);
        console.log('\n📋 Found plans:');
        if (parsed.data && Array.isArray(parsed.data)) {
          parsed.data.forEach(plan => {
            console.log(`   - ${plan.id}: ${plan.name || 'Unnamed'} - $${plan.price || 'No price'}`);
          });
        } else {
          console.log('No plans data array found');
        }
      } catch (e) {
        console.log('Could not parse JSON response');
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Method 3: List all company plans
  console.log('\n3️⃣ Listing all company plans...');
  try {
    const response = await fetch('https://api.whop.com/api/v5/company/plans', {
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Status:', response.status);
    const data = await response.text();
    console.log('Response:', data);
    
    if (response.ok) {
      try {
        const parsed = JSON.parse(data);
        console.log('\n📋 All company plans:');
        if (parsed.data && Array.isArray(parsed.data)) {
          parsed.data.forEach(plan => {
            console.log(`   - ${plan.id}: ${plan.name || 'Unnamed'} - $${plan.price || 'No price'}`);
            if (plan.id === PLAN_ID) {
              console.log('     ✅ FOUND OUR TARGET PLAN!');
            }
          });
        } else {
          console.log('No plans data array found');
        }
      } catch (e) {
        console.log('Could not parse JSON response');
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Method 4: Try different API versions
  console.log('\n4️⃣ Testing with API v2...');
  try {
    const response = await fetch(`https://api.whop.com/api/v2/plans/${PLAN_ID}`, {
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('v2 Status:', response.status);
    const data = await response.text();
    console.log('v2 Response:', data);
  } catch (error) {
    console.log('❌ v2 Error:', error.message);
  }

  // Method 5: Test checkout creation directly
  console.log('\n5️⃣ Testing checkout creation with this plan...');
  try {
    const response = await fetch('https://api.whop.com/api/v5/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: PLAN_ID,
        metadata: {
          test: 'true'
        }
      })
    });
    
    console.log('Checkout Status:', response.status);
    const data = await response.text();
    console.log('Checkout Response:', data);
  } catch (error) {
    console.log('❌ Checkout Error:', error.message);
  }

  console.log('\n🏁 Plan test completed!');
}

testSpecificPlan().catch(console.error);
