// Test script to verify Whop integration setup
// Run with: node test-whop-integration.js

const WHOP_API_KEY = 'Uo7gzvenzpQFoEnLQry6b4Cn_tbR9ISOaaqw1hTSejc';
const PRODUCT_ID = 'prod_gBkccTFAkZwYi';

async function testWhopAPI() {
  console.log('🧪 Testing Whop API Integration...\n');

  // Test 1: Check API key validity
  console.log('1️⃣ Testing API key validity...');
  try {
    const response = await fetch('https://api.whop.com/api/v5/me', {
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API key valid - User:', data.username || data.email || 'Unknown');
    } else {
      console.log('❌ API key invalid - Status:', response.status);
      const error = await response.text();
      console.log('Error:', error);
    }
  } catch (error) {
    console.log('❌ API request failed:', error.message);
  }

  // Test 2: Check product exists
  console.log('\n2️⃣ Testing product access...');
  try {
    const response = await fetch(`https://api.whop.com/api/v5/company/products/${PRODUCT_ID}`, {
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Product found:', data.name || data.title || 'Unnamed Product');
    } else {
      console.log('❌ Product not found - Status:', response.status);
      const error = await response.text();
      console.log('Error:', error);
    }
  } catch (error) {
    console.log('❌ Product request failed:', error.message);
  }

  // Test 3: List all products (to see what we have access to)
  console.log('\n3️⃣ Listing available products...');
  try {
    const response = await fetch('https://api.whop.com/api/v5/company/products', {
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Available products:');
      if (Array.isArray(data)) {
        data.forEach(product => {
          console.log(`   - ${product.id}: ${product.name || product.title || 'Unnamed'}`);
        });
      } else {
        console.log('   Products data:', data);
      }
    } else {
      console.log('❌ Cannot list products - Status:', response.status);
    }
  } catch (error) {
    console.log('❌ Products list failed:', error.message);
  }

  // Test 4: Test plan IDs directly
  console.log('\n4️⃣ Testing individual plan IDs...');
  const planIds = [
    'plan_KmHruy3fDVOtP', // $50
    'plan_6U0rRsvDL9VvM', // $40
    'plan_4uR7cOFf9Ruxl', // $30
    'plan_QRc2RVkLKgK5l', // $25
    'plan_xj1hzkSUCPewx', // $20
    'plan_ktRtPxomsvkPt'  // $15
  ];

  for (const planId of planIds) {
    try {
      const response = await fetch(`https://api.whop.com/api/v5/company/plans/${planId}`, {
        headers: {
          'Authorization': `Bearer ${WHOP_API_KEY}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${planId}: ${data.name || 'Found'} - $${data.price || 'Unknown'}`);
      } else {
        console.log(`❌ ${planId}: Not found (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${planId}: Request failed`);
    }
  }

  // Test 5: Try creating a checkout session with one plan
  console.log('\n5️⃣ Testing checkout session creation...');
  try {
    const response = await fetch('https://api.whop.com/api/v5/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: 'plan_KmHruy3fDVOtP',
        metadata: {
          test: 'true',
          user_id: 'test_user',
          domain_slot_purchase: 'true'
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Checkout session created:', data.id || 'Success');
      console.log('   Checkout URL:', data.checkout_url || 'No URL provided');
    } else {
      console.log('❌ Checkout session failed - Status:', response.status);
      const error = await response.text();
      console.log('Error:', error);
    }
  } catch (error) {
    console.log('❌ Checkout session request failed:', error.message);
  }

  console.log('\n🏁 Test completed!');
}

// Run the test
testWhopAPI().catch(console.error);
