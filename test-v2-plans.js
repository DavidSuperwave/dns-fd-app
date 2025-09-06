// Test V2 API plans endpoint
const WHOP_API_KEY = 'Uo7gzvenzpQFoEnLQry6b4Cn_tbR9ISOaaqw1hTSejc';
const PRODUCT_ID = 'prod_gBkccTFAkZwYi';

async function testV2Plans() {
  console.log('🧪 Testing V2 Plans API...\n');

  // Test 1: List all plans
  console.log('1️⃣ Fetching all plans...');
  try {
    const response = await fetch('https://api.whop.com/api/v2/plans', {
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Got plans data');
      console.log('Total plans:', data.length);
      
      // Filter by our product
      const ourPlans = data.filter(plan => plan.product === PRODUCT_ID);
      console.log('\n📋 Our product plans:');
      ourPlans.forEach(plan => {
        console.log(`   - ${plan.id}: ${plan.description || 'No description'}`);
        console.log(`     Price: $${plan.renewal_price} ${plan.base_currency}`);
        console.log(`     Link: ${plan.direct_link}`);
        console.log('');
      });
      
      // Test the specific plan we know exists
      const targetPlan = ourPlans.find(p => p.id === 'plan_KmHruy3fDVOtP');
      if (targetPlan) {
        console.log('✅ Found our target plan:', targetPlan.description);
      } else {
        console.log('❌ Target plan not found in list');
      }
      
    } else {
      const error = await response.text();
      console.log('❌ Failed:', error);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

testV2Plans().catch(console.error);
