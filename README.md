# LittleApp v3.8

**v3.8:** จัดการพอร์ตได้ยืดหยุ่นขึ้น แก้ชื่อพอร์ต/Broker พิมพ์ Broker ใหม่ ลบพอร์ตว่าง หรือย้ายข้อมูลก่อนลบ พร้อมกู้คืน อ่าน [คู่มือ v3.8](UPDATE-V38.md)

**v3.7:** จำค่าประจำพอร์ต, กล่องรายการที่ต้องตรวจ, SL ปัจจุบัน/ความเสี่ยงสถานะเปิด, Funding/Swap ตามวันที่ และนำเข้า Exness CSV แบบจับคู่คอลัมน์สำหรับ XAUUSD อ่าน [คู่มือ v3.7](UPDATE-V37.md)

**v3.6:** เพิ่มไม้ Futures, โอนเงินระหว่างพอร์ต, ตรวจ Balance, ประวัติแก้ไข/กู้คืน, นำเข้า Futures CSV และเลือกสถิติต่อดีล/ต่อไม้ปิด โดยคง 3 เมนูหลัก อ่าน [คู่มือ v3.6](UPDATE-V36.md)

**v3.5:** เพิ่มปิด Futures บางส่วนและฝากถอน/ประวัติ Equity อ่าน [คู่มือ v3.5](UPDATE-V35.md)

เว็บแอพบันทึกการเทรดและพอร์ตสะสมส่วนตัว ด้วย HTML, CSS และ JavaScript พร้อมระบบล็อกอินและฐานข้อมูล Supabase Free

**v3.4:** ลดเหลือ 3 เมนูหลัก เชื่อมรายการกับบททบทวน และเพิ่ม Funding อ่าน [คู่มือและรายการสิ่งที่ยังขาด](UPDATE-V34.md)

**v3.3.1:** Exness + XAUUSD ใช้ตัวคูณ 100 อัตโนมัติทั้งแผนและรายการจริง ช่องตัวคูณล็อกให้ เมื่อเปลี่ยนสินทรัพย์หรือโบรกเกอร์อื่นจะกลับมาแก้ไขได้ รายการเก่าที่ตัวคูณผิดให้เปิดแก้ไขและบันทึกใหม่ หาก 1R เดิมคำนวณจากตัวคูณผิดให้กดคำนวณ 1R ใหม่ด้วย ไม่มีการเขียนทับประวัติทั้งหมดอัตโนมัติ ไม่ต้อง Run SQL ใหม่

**Analytics และทบทวน:** อ่าน [คู่มือ v3.3](UPDATE-V33.md) ใช้ฐานข้อมูลเดิมได้

**ราคาออนไลน์รุ่นใหม่:** อ่าน [คู่มือ v3.2](UPDATE-V32.md) ต้องอัปโหลดโฟลเดอร์ `api` ที่ระดับเดียวกับ `dist` ด้วย

**อัปเดตจากรุ่นเดิม:** อ่าน [คู่มือรวมแผนและบันทึก v3.1](UPDATE-V31.md) และ [คู่มือ v3](UPDATE-V3.md) ใช้ฐานข้อมูลเดิมได้ ไม่ต้อง Run SQL ใหม่

**เริ่มที่ [คู่มือเชื่อม Supabase](SUPABASE-SETUP.md)**: Run `supabase/schema.sql`, ตรวจค่าใน `dist/config.js`, สร้างผู้ใช้ แล้วอัปเดต GitHub เพื่อ deploy บน Vercel

## อัปโหลดเข้า GitHub

1. แตกไฟล์ ZIP ที่ดาวน์โหลด
2. สร้าง repository ใหม่บน GitHub เช่น `littleapp`
3. เลือก **uploading an existing file** หรือ **Add file → Upload files**
4. อัปโหลดโฟลเดอร์ `api`, `dist`, `supabase` พร้อม `vercel.json`, `README.md`, `SUPABASE-SETUP.md` และ `.gitignore` ไว้ที่ระดับบนสุดของ repository แล้วกด **Commit changes**

อย่าอัปโหลด ZIP โดยตรง และอย่าซ้อนทุกไฟล์ไว้ในโฟลเดอร์ LittleApp-GitHub อีกชั้น

โครงสร้างที่ถูกต้อง:

```text
littleapp/
├── api/
│   └── prices.js
├── dist/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── config.js
│   ├── engine.js
│   ├── features.js
│   └── features.css
├── supabase/
│   └── schema.sql
├── SUPABASE-SETUP.md
├── vercel.json
├── .gitignore
└── README.md
```

## Deploy บน Vercel

1. เข้าสู่ระบบ Vercel แล้วเลือก **Add New → Project**
2. เชื่อมต่อ GitHub และ Import repository `littleapp`
3. ตรวจสอบค่าต่อไปนี้แล้วกด **Deploy**:

| การตั้งค่า | ค่า |
| --- | --- |
| Framework Preset | Other |
| Root Directory | ระดับบนสุดของ repository (`./`) |
| Build Command | เว้นว่าง |
| Install Command | เว้นว่าง |
| Output Directory | `dist` |
| Environment Variables | ไม่ต้องตั้งค่า |

ไฟล์ `vercel.json` กำหนด framework, คำสั่ง build/install และ output directory ให้แล้ว ใช้ Root Directory ที่มีไฟล์นี้ ไม่เลือก `dist` เป็น root

เมื่อ deploy สำเร็จ เปิด URL ที่ Vercel ให้มา เมื่อแก้ไฟล์และ commit ไปยัง production branch ของโปรเจกต์ Vercel จะ deploy เวอร์ชันใหม่ผ่าน Git integration

เอกสาร: [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json) · [Vercel Git integration](https://vercel.com/docs/git)

## ใช้งานในเครื่อง

ใช้ผ่าน URL ของ Vercel หลังตั้งค่า Supabase แล้ว ระบบต้องใช้อินเทอร์เน็ต โค้ดอยู่ใน `dist/app.js` และรูปแบบหน้าจออยู่ใน `dist/style.css`

## ความสามารถและข้อมูล

- บันทึก แก้ไข ลบการเทรด XAUUSD และ BTCUSDT แบบ Long/Short ทั้งรายการเปิดและปิด
- สรุปกำไรขาดทุนหลังค่าธรรมเนียม อัตราชนะ และกราฟสะสม แยก USD / USDT / THB
- บันทึกหุ้นไทย ทองคำแท่ง และบิทคอยน์ที่ยังถือครอง พร้อมต้นทุนและราคาประเมินที่กรอกเอง
- ส่งออก/นำเข้าไฟล์สำรอง JSON
- ข้อมูลอยู่ใน Supabase แยกตามบัญชี โหลดเมื่อเข้าสู่ระบบหรือกดโหลดข้อมูลล่าสุด ไม่ใช่ realtime และไม่บันทึกแบบออฟไลน์
- เมื่อต้องการย้ายจากไฟล์ในเครื่องไปยังเว็บ Vercel หรือเปลี่ยนโดเมน ให้สำรองข้อมูลจากที่เดิมแล้วนำเข้าที่ใหม่
- ประวัติซื้อขาย Spot คิดต้นทุนเฉลี่ยเคลื่อนที่และกำไรขาย พร้อมรายงานรายเดือน แผนก่อนเทรด และสมุดทบทวนพร้อมภาพ
- ฟิวเจอร์ใช้สูตร linear: (ราคาออก − ราคาเข้า) × จำนวน × ตัวคูณ × ทิศทาง − ค่าธรรมเนียม ตั้งตัวคูณตามสัญญาของโบรกเกอร์ รองรับ BTCUSD Inverse ชำระ BTC เพิ่มเติมตามคู่มือ UPDATE-V2.md และไม่คำนวณ margin/liquidation
- รุ่น v3.2 ดึงราคาอ้างอิง XAUUSD และ BTC ได้ พร้อมกำไรค้างอยู่ แหล่งราคาและข้อจำกัดอยู่ใน UPDATE-V32.md ไม่มีการแปลงค่าเงินอัตโนมัติ ฟอนต์จาก Google Fonts ใช้ฟอนต์สำรองเมื่อออฟไลน์

## การตรวจสอบชุดไฟล์

ตรวจสอบ JavaScript syntax, JSON, ตำแหน่งไฟล์อ้างอิง และความครบถ้วนของ ZIP แล้ว การ deploy จริงต้องดำเนินการในบัญชี Vercel ของคุณตามขั้นตอนด้านบน



