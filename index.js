const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const INPUT_FILE = path.join(__dirname, "phone_numbers.txt");
const OUTPUT_FILE = path.join(__dirname, "valid_numbers.json");

const message = "Hello 👋! This is a test broadcast message sent via automation. Hope you're doing great!";

// Read phone numbers from the file
function readPhoneNumbers() {
  const data = fs.readFileSync(INPUT_FILE, "utf-8");
  return data
    .split("\n")
    .map((num) => num.trim().replace(/^\+/, ""))
    .filter(Boolean);
}

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

(async () => {
  const phoneNumbers = readPhoneNumbers();
  const validNumbers = [];

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: "./user_data",
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();
  await page.goto("https://web.whatsapp.com");

  console.log("📱 Waiting for WhatsApp Web login...");
  await page.waitForSelector('button[aria-label="New chat"]', { timeout: 0 });
  console.log("✅ Logged in to WhatsApp Web!");

  for (const number of phoneNumbers) {
    console.log(`\n🔍 Checking: ${number}`);
    const msgURL = `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`;

    try {
      await page.goto(msgURL);
      await wait(4000);
    
      // ✅ Check if the invalid number modal is visible
      const modalSelector = 'div[role="dialog"]';
      const modal = await page.$(modalSelector);
    
      if (modal) {
        const modalText = await page.evaluate(el => el.innerText, modal);
        if (modalText.includes("Phone number shared via url is invalid")) {
          console.log(`❌ ${number} is NOT on WhatsApp`);
          
          // Optional: Close the modal (click OK or Close if needed)
          const closeBtn = await modal.$('div[role="button"]');
          if (closeBtn) await closeBtn.click();
    
          continue; // move to next number
        }
      }
    
      // ✅ If no modal, proceed to wait for chat UI
      await page.waitForSelector("#main", { timeout: 20000 });
      console.log(`✅ ${number} is on WhatsApp`);
    

      await page.waitForSelector('button[aria-label="Send"]', { timeout: 10000 });
      await wait(1000);

      const sendBtn = await page.$('button[aria-label="Send"]');
      if (sendBtn) {
        await sendBtn.click();
        console.log(`📨 Message sent to ${number}`);
      } else {
        console.log(`⚠️ Send button not found for ${number}`);
      }
    } catch (err) {
      console.log(`⚠️ Error with ${number}: ${err.message}`);
    }

    await wait(3000);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validNumbers, null, 2));
  console.log(`\n✅ Done! ${validNumbers.length} valid numbers saved to '${OUTPUT_FILE}'`);

  await browser.close();
})();
