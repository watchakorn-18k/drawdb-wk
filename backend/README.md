# DrawDB Backend (Cloudflare Workers + Hono + D1)

Backend สำหรับระบบแชร์และเก็บประวัติเวอร์ชันของไดอะแกรม DrawDB พัฒนาด้วย:
- **[Hono](https://hono.dev)**: Web framework น้ำหนักเบา รวดเร็ว และรองรับ Cloudflare Workers natively
- **[Cloudflare Workers](https://workers.cloudflare.com)**: Serverless compute edge runtime
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)**: Serverless SQLite database บน Cloudflare

---

## ฟีเจอร์ที่รองรับ (Features)

1. **แชร์ไดอะแกรม (Share Diagrams)**:
   - สร้างลิงก์แชร์ไดอะแกรม (`POST /gists`)
   - เปิดดูไดอะแกรมจากลิงก์แชร์ (`GET /gists/:id`) -> `/editor?shareId=:id`
   - อัปเดตไดอะแกรมที่แชร์ (`PATCH /gists/:id`)
   - ยกเลิกการแชร์ (`DELETE /gists/:id` หรือ `PATCH` content ว่าง)
2. **ประวัติเวอร์ชัน (Version History & Revisions)**:
   - บันทึกเวอร์ชัน (`gist_versions`) ทุกครั้งที่มีการบันทึก
   - เรียกดูรายการเวอร์ชันย้อนหลัง (`GET /gists/:id/file-versions/:file`)
   - โหลดไดอะแกรมตามเวอร์ชัน/commit sha (`GET /gists/:id/:sha`)
   - เปรียบเทียบความแตกต่างระหว่างเวอร์ชัน (`GET /gists/:id/file/:file/compare/:versionA/:versionB`)
3. **CORS & Email Stub**:
   - เปิด CORS สำหรับ frontend ทุก origin
   - รองรับ endpoint สรุป/แจ้งเตือน (`POST /email/send`)

---

## โครงสร้างโปรเจกต์ (Project Structure)

```text
backend/
├── src/
│   └── index.ts          # Hono routes & logic
├── schema.sql            # D1 database schema
├── wrangler.jsonc        # Cloudflare Workers & D1 configuration
├── package.json
└── tsconfig.json
```

---

## การรันในเครื่อง (Local Development)

### 1. ติดตั้ง Dependencies
```bash
cd backend
bun install   # หรือ npm install
```

### 2. สร้างฐานข้อมูล D1 ในเครื่อง (Local D1)
```bash
bun run d1:init:local
# หรือ
npm run d1:init:local
```

### 3. รัน Server Worker ในเครื่อง
```bash
bun run dev
# หรือ
npm run dev
```
Worker จะเริ่มทำงานที่: `http://localhost:8787`

### 4. เชื่อมต่อกับ Frontend DrawDB
ใน root directory ของโปรเจกต์ สร้างหรือแก้ไขไฟล์ `.env`:
```env
VITE_BACKEND_URL=http://localhost:8787
```
จากนั้นรัน frontend:
```bash
npm run dev
```
เมื่อกดปุ่ม **Share** ใน DrawDB จะสร้าง URL แชร์ `http://localhost:5173/editor?shareId=...` ซึ่งสามารถเปิดและโหลดข้อมูลจาก backend D1 ได้ทันที!

---

## การ Deploy ขึ้น Cloudflare จริง (Production Deployment)

### 1. ล็อกอิน Cloudflare ผ่าน Wrangler
```bash
npx wrangler login
```

### 2. สร้าง D1 Database บน Cloudflare
```bash
npx wrangler d1 create drawdb-db
```
คำสั่งจะแสดงผลข้อมูลเช่น:
```text
database_name = "drawdb-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 3. อัปเดต `backend/wrangler.jsonc`
นำ `database_id` ที่ได้มาใส่ในช่อง `database_id` ของ `backend/wrangler.jsonc`:
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "drawdb-db",
    "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
]
```

### 4. รันคำสั่งสร้างตารางบน Production D1
```bash
npm run d1:init:remote
```

### 5. Deploy Worker ขึ้น Cloudflare
```bash
npm run deploy
```
จะได้ URL สำหรับ production เช่น `https://drawdb-backend.<your-subdomain>.workers.dev`

นำ URL นี้ไปใส่ใน environment variable `VITE_BACKEND_URL` สำหรับ frontend ของคุณ!

---

## การ Deploy อัตโนมัติด้วย GitHub Actions (CI/CD)

ไฟล์ Workflow อยู่ที่ [`.github/workflows/deploy-backend.yml`](../.github/workflows/deploy-backend.yml)

เมื่อมีการ `git push` เข้าสู่ branch `main` ที่มีการเปลี่ยนแปลงในโฟลเดอร์ `backend/` หรือรันผ่านเมนู **Run workflow** ในแท็บ Actions ของ GitHub ตัว Action จะทำ:
1. เช็คความถูกต้องของ Type (`tsc --noEmit`)
2. รัน Migration อัปเดตโครงสร้างตาราง D1 บน Cloudflare (`schema.sql`)
3. Deploy Worker ขึ้น Cloudflare ให้อัตโนมัติ

### สิ่งที่ต้องตั้งค่าใน GitHub Repository Secrets:
ไปที่ **GitHub Repo -> Settings -> Secrets and variables -> Actions**:
1. `CLOUDFLARE_API_TOKEN`: Cloudflare API Token (สร้างที่ Cloudflare Dashboard -> My Profile -> API Tokens โดยเลือก Template **Edit Cloudflare Workers** และเพิ่มสิทธิ์ Account **D1:Edit**)
2. `CLOUDFLARE_ACCOUNT_ID`: Account ID ของคุณ (ดูได้จากหน้าแดชบอร์ด Cloudflare Workers & Pages ในแถบขวามือ)
3. *(ตัวเลือกสำหรับ Frontend GitHub Pages)*: ตั้งค่า `VITE_BACKEND_URL` ใน Variables หรือ Secrets เพื่อให้ GitHub Pages เชื่อมต่อกับ Backend โดยอัตโนมัติ

