const Stripe = require('stripe');
require('dotenv').config({ path: '.env' });

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function setupProducts() {
  console.log('Setting up Stripe Products...');
  try {
    const proProduct = await stripe.products.create({
      name: 'Pro Plan',
      description: 'Unlimited queries, 10 database connections, Data visualization',
    });
    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 2900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    console.log(`STRIPE_PRO_PRICE_ID=${proPrice.id}`);

    const entProduct = await stripe.products.create({
      name: 'Enterprise Plan',
      description: 'Everything in Pro + Unlimited connections, SSO, Custom AI models',
    });
    const entPrice = await stripe.prices.create({
      product: entProduct.id,
      unit_amount: 9900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    console.log(`STRIPE_ENTERPRISE_PRICE_ID=${entPrice.id}`);

    const fs = require('fs');
    let envData = fs.readFileSync('.env', 'utf8');
    envData = envData.replace(/STRIPE_PRO_PRICE_ID=.*/g, `STRIPE_PRO_PRICE_ID=${proPrice.id}`);
    envData = envData.replace(/STRIPE_ENTERPRISE_PRICE_ID=.*/g, `STRIPE_ENTERPRISE_PRICE_ID=${entPrice.id}`);
    fs.writeFileSync('.env', envData);
    
    console.log('\nSuccessfully saved Price IDs to .env file!');

  } catch (err) {
    console.error('Error setting up products:', err.message);
  }
}

setupProducts();
