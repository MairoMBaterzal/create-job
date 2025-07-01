const puppeteer = require('puppeteer');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

app.post('/run', async (req, res) => {
  const { jobs, payment, monthlyTerm, jobNumber, description, poNumber, addNotes, term } = req.body;
  console.log('📦 Received jobs:', jobs);

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Login
  await page.goto('https://auth.servicefusion.com/auth/login', { waitUntil: 'networkidle2' });
  await page.type('#company', 'pfs21485');
  await page.type('#uid', 'Lui-G');
  await page.type('#pwd', 'Premierlog5335!');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  for (const jobUrl of jobs) {
    console.log(`🔄 Visiting Job: ${jobUrl}`);
    
// Wait to ensure all previous operations complete
await new Promise(resolve => setTimeout(resolve, 3000));

try {
  console.log(`🔁 Re-visiting Job URL to invoice: ${jobUrl}`);
  const response = await page.goto(jobUrl, { waitUntil: 'load', timeout: 15000 });

  if (!response || !response.ok()) {
    throw new Error(`❌ Failed to load job URL: ${jobUrl}`);
  }
  console.log('🔄 Revisit successful');

} catch (err) {
  console.error('❌ Navigation error:', err.message);
  continue; // Skip to next job
}


    try {
      const customerLinkSelector = 'a[href^="/customer/editCustomer?id="]';
      await page.waitForSelector(customerLinkSelector, { timeout: 5000 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click(customerLinkSelector)
      ]);
      console.log('✅ Opened customer profile');
      // 📝 Add dynamic note to customer profile about replenishment month
      try {
        console.log('🧾 Opening "Add → Note" dropdown');
        await page.waitForSelector('button.add-new-btn', { visible: true });
        await page.click('button.add-new-btn');
        await page.waitForSelector('a.add-new-note-btn', { visible: true });
        await page.click('a.add-new-note-btn');
        await page.waitForSelector('#note-notes', { visible: true });

        const now = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
        const currentCT = new Date(now);
        const startDate = new Date(currentCT.getFullYear(), currentCT.getMonth() + 1, 1);
        startDate.setMonth(startDate.getMonth() + parseInt(monthlyTerm));
        const replenishedMonth = startDate.toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();

        const finalNote = `RECURRING INVOICES FOR Installation Job# ${jobNumber} RENT TO OWN PROGRAM SHOULD BE REPLENISHED BY ${replenishedMonth}`;

        
        await page.type('#note-notes', finalNote, { delay: 30 });

        // ✅ Click the "Pin to top" checkbox
        
        // ✅ Wait for "Pin to top" checkbox to be visible and clickable
        await page.waitForSelector('input[name="note-in_top"]', { visible: true, timeout: 3000 });
        await page.evaluate(() => {
          const checkbox = document.querySelector('input[name="note-in_top"]');
          if (checkbox && !checkbox.checked) checkbox.click();
        });


        // Click Add button to save note
        await page.click('button.note-form__save-btn');
        console.log('✅ Customer profile note added');

        console.log('✅ Customer profile note added');
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (err) {
        console.error('❌ Failed to add customer note:', err.message);
      }


      await new Promise(resolve => setTimeout(resolve, 1000));
      await page.click('button.dropdown-toggle');
      const newJobLinkSelector = 'a[href^="/jobs/jobsAdd?from=customer&customerid="]';
      await page.waitForSelector(newJobLinkSelector, { timeout: 5000 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click(newJobLinkSelector)
      ]);
      console.log('🆕 Navigated to New Job page');

      await page.waitForSelector('select#select_status', { timeout: 5000 });
      await page.select('#select_status', '1018574117');
      console.log('✅ Status set to Scheduled');

      // Calculate Texas time and set start date to first of next month
      const now = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
      const currentCT = new Date(now);
      const startDate = new Date(currentCT.getFullYear(), currentCT.getMonth() + 1, 1); // 1st of next month

      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth(); // 0-based

      await page.click('#job-start-date-image');
      await page.waitForSelector('.ui-datepicker-calendar', { timeout: 5000 });
      await page.select('select.ui-datepicker-month', String(startMonth));
      await page.select('select.ui-datepicker-year', String(startYear));

      await page.evaluate(() => {
        const calendar = document.querySelector('.ui-datepicker-calendar');
        [...calendar.querySelectorAll('a.ui-state-default')].find(el => el.textContent === '1')?.click();
      });

      console.log(`📅 Start date set to ${startYear}-${String(startMonth + 1).padStart(2, '0')}-01`);

      await page.evaluate(() => {
        const repeatCheckbox = document.querySelector('#repeat-job');
        if (repeatCheckbox) repeatCheckbox.click();
      });
      console.log('🔁 Opened Repeat Job modal');

      await page.waitForSelector('#repeat-job-modal', { visible: true, timeout: 5000 });
      await page.waitForSelector('#monthly');
      await page.click('#monthly');
      console.log('📆 Selected Monthly');

      await page.waitForSelector('#stop_repeating-1', { visible: true });
      await page.click('#stop_repeating-1');

      await page.waitForSelector('#occurence_nos', { visible: true });
      await page.focus('#occurence_nos');
      await page.click('#occurence_nos', { clickCount: 3 });
      await page.keyboard.type(String(monthlyTerm));
      await page.evaluate((val) => {
        const input = document.querySelector('#occurence_nos');
        input.setAttribute('aria-valuenow', val);
      }, monthlyTerm);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Slightly longer wait
      console.log(`🔂 Repeat set to ${monthlyTerm} occurrences`);

      await page.evaluate(() => {
        const radio = document.querySelector('#day-of-month');
        if (radio) radio.click();
      });
      console.log('📅 Selected "Day of the month"');

      await page.select('#create_repeat_jobs', 'N');
      console.log('⚡ Set Repeat Jobs creation to Right now');

      await page.select('#initial_status', '1018574117');
      console.log('📌 Initial job status = Scheduled');

      await page.click('#save-repeat-job-btn');
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('💾 Saved repeat job modal');

      await page.evaluate(() => {
        const dropdown = document.querySelector('#s2id_jobModel_ubase_job_categories_id .select2-choice');
        if (dropdown) dropdown.click();
      });
      await page.select('#jobModel_ubase_job_categories_id', '76167');
      console.log('📂 Job Category set to Equipment Rental');

      if (description) {
        const filledDesc = description.replace('{monthlyTerm}', monthlyTerm);
        await page.type('#description', filledDesc);
        console.log('📝 Description set');
      }

      if (poNumber && poNumber.toLowerCase() !== 'null') {
        await page.type('#job-po-number', poNumber);
        console.log(`🔢 PO Number set: ${poNumber}`);
      } else {
        console.log('⚠️ No PO number provided');
      }

	// ==== 💬 Add Notes Section ====
	console.log("Opening Add Notes section");
	await page.click('button.btn-margin.pull-right'); // Clicks "Add Notes"
	await page.waitForSelector('#add-new-note', { visible: true });

	const interpolatedNotes = addNotes
    	.replace('{jobNumber}', jobNumber)
    	.replace('{monthlyTerm}', monthlyTerm);

	await page.type('#add-new-note', interpolatedNotes, { delay: 50 }); // Typing notes
	await page.click('#add-new-note-btn'); // Clicks "Add"
	console.log("Note added successfully");

     	// ===== 🔍 Add "Rental" Service Item =====
	console.log("🧾 Adding 'Rental' from Products & Services");

	// Wait for search box and type 'rental'
	await page.waitForSelector('#service-product-search-box', { visible: true });
	await page.type('#service-product-search-box', 'rental', { delay: 100 });

	// Wait for the dropdown with id 'list_global_1' and click it
	await page.waitForSelector('li#list_global_1[li_name="Rental"]', { visible: true, timeout: 5000 });
	await page.click('li#list_global_1[li_name="Rental"]');

	console.log("📦 Rental item added to Products & Services");

 	// Step 13: Set quantity = 1 (change aria-valuenow attribute too)
	await page.evaluate(() => {
  	const qtyInput = document.querySelector('input[id^="spinner-decimal-"][aria-valuenow]');
  	if (qtyInput) {
    	qtyInput.value = '1';
    	qtyInput.setAttribute('aria-valuenow', '1');
  	}
	});
	console.log('🔢 Quantity set to 1');

      // Step 14: Set unit price
      await page.evaluate((payment) => {
        const priceInput = document.querySelector('input[id^="unit-price-services-"]');
        if (priceInput) priceInput.value = payment;
      }, payment);
      console.log(`💲 Set unit price = ${payment}`);

      // Step 15: Click "More" and update long description textarea
	await page.evaluate(() => {
  	const moreBtn = document.querySelector('button[id^="long-text-services-button-"]');
  	if (moreBtn) moreBtn.click();
	});

	await page.waitForSelector('textarea[id^="long-text-services-"]', { visible: true });

	const updatedTerm = term.replace('{monthlyTerm}', monthlyTerm);

	await page.evaluate((filledText) => {
  	const textarea = document.querySelector('textarea[id^="long-text-services-"]');
  	if (textarea) textarea.value = filledText;
	}, updatedTerm);

	console.log('📝 Long description updated');

	// 💾 Save the job after long description update
	await page.waitForSelector('#createjobbottom', { visible: true });
	await page.click('#createjobbottom');
	console.log('✅ Clicked Save Job');
	await page.waitForNavigation({ waitUntil: 'networkidle2' });


      await new Promise(resolve => setTimeout(resolve, 10000));
      // Revisit job URL to invoice and update status
      console.log(`🔁 Re-visiting Job URL to invoice: ${jobUrl}`);
      await page.goto(jobUrl, { waitUntil: 'networkidle2' });

      try {
        // Click invoice button
        await page.waitForSelector('button[onclick*="createInvoiceFromClosedJob"]', { timeout: 5000 });
        await page.click('button[onclick*="createInvoiceFromClosedJob"]');
        console.log('✅ Clicked Invoice button');

        // Confirm "Invoice Now"
        await page.waitForSelector('button.jquery-msgbox-button-submit', { timeout: 10000 });
        const buttons = await page.$$('button.jquery-msgbox-button-submit');
        for (const btn of buttons) {
          const text = await page.evaluate(el => el.textContent.trim(), btn);
          if (text === 'Invoice Now') {
            await btn.click();
            console.log('🎉 Clicked Invoice Now');
            break;
          }
        }

        // Wait for invoice to finish processing
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Change status to "Needs Estimate" via inline-editable dropdown
        console.log("✏️ Attempting to change status to 'Needs Estimate'");

        await page.waitForSelector('#statusManual', { visible: true });
        await page.click('#statusManual'); // Click to activate the editable dropdown

        // Wait for the actual select dropdown to appear
        await page.waitForSelector('.editable-container select', { visible: true, timeout: 5000 });

        // Select 'Needs Estimate' from the dropdown (value = 1018574128)
        await page.select('.editable-container select', '1018574128');
        console.log("✅ Status selected: Needs Estimate");

        // Optional: Wait a bit for change to persist
        await new Promise(resolve => setTimeout(resolve, 2000));
      // 🧾 Locate and delete the invoice linked to the job
      try {
        console.log("🔗 Navigating to invoice page");

        // Wait and click the first invoice link
        await page.waitForSelector('a[href^="/viewInvoice?id="]', { visible: true, timeout: 5000 });
        const invoiceLink = await page.$('a[href^="/viewInvoice?id="]');
        const href = await page.evaluate(el => el.getAttribute('href'), invoiceLink);
        const invoiceUrl = 'https://admin.servicefusion.com' + href;
        await page.goto(invoiceUrl, { waitUntil: 'networkidle2' });
        console.log("📄 Invoice page opened");

        // Click the Delete button
        await page.waitForSelector('a.btn.pull-right[onclick^="deleteInvoice"]', { visible: true, timeout: 5000 });
        await page.click('a.btn.pull-right[onclick^="deleteInvoice"]');
        console.log("🗑 Delete button clicked");

        // Confirm the deletion modal
        await page.waitForSelector('button.jquery-msgbox-button-submit', { visible: true, timeout: 5000 });
        const confirmButtons = await page.$$('button.jquery-msgbox-button-submit');
        for (const btn of confirmButtons) {
          const text = await page.evaluate(el => el.textContent.trim(), btn);
          if (text === 'Yes') {
            await btn.click();
            console.log('✅ Invoice deletion confirmed');
            break;
          }
        }

        // Wait a bit to ensure invoice is deleted
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (err) {
        console.error('❌ Error while deleting invoice:', err.message);
      }


        // Optional modal for recurring jobs
        try {
          await page.waitForSelector('button.jquery-msgbox-button-submit', { timeout: 3000 });
          const modalButtons = await page.$$('button.jquery-msgbox-button-submit');
          for (const btn of modalButtons) {
            const text = await page.evaluate(el => el.textContent.trim(), btn);
            if (text === 'Only This Job') {
              await btn.click();
              console.log('➡️ Clicked "Only This Job" on modal');
              break;
            }
          }
        } catch {
          console.log('ℹ️ No modal appeared after status change');
        }
      } catch (err) {
        console.error('❌ Error during invoicing or status update:', err.message);
      }
 // 👀 observe before closing

    } catch (err) {
      console.error('❌ Error during job processing:', err.message);
    }
  }

  await browser.close();
  res.send({ message: '✅ All jobs processed and updated successfully.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Puppeteer server listening on http://localhost:${PORT}/run`);
});
