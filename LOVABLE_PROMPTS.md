# Insure! — Lovable 개발 프롬프트 순서

> 작성 기준: IA.md v2 / PRD.md v1.0 / USER_JOURNEY.md v2  
> 총 5단계 프롬프트 / 각 프롬프트는 이전 결과물 위에 누적 빌드

---

## 프롬프트 1 — 프로젝트 기반 + 디자인 시스템 + 랜딩 + Supabase 스키마

```
Build a web application called "Insure!" — a Korean rental contract platform for foreign tenants and landlords.

## Tech Stack
- React + TypeScript + Vite
- Tailwind CSS
- React Router v6 (for routing)
- Supabase (database + realtime)
- shadcn/ui components where appropriate

## Design System
Apply these globally:
- Font: Pretendard (import from CDN: https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css)
- Background: #F5F6F8
- Primary blue: #3182F6
- Text primary: #191F28
- Text secondary: #6B7684
- Text hint: #8B95A1
- Border: #E8EAED
- Success green: #00B493
- Warning yellow: #F59E0B
- Danger red: #E03131
- Card: white background, border-radius 16px, subtle box-shadow
- Button primary: #3182F6, white text, border-radius 14px, padding 16px, font-weight 700
- Button secondary: #F2F4F6, #191F28 text, same radius/padding
- Input field: border 1.5px #E8EAED, border-radius 12px, padding 14px 16px, focus border #3182F6
- All UI mobile-first (max-width 480px centered on desktop)

## Routes
Set up React Router with these routes:
- "/" → Landing page
- "/landlord" → Landlord dashboard
- "/landlord/new" → New contract wizard
- "/landlord/contract/:id" → Contract detail
- "/contract/:id" → Tenant contract flow

## Landing Page (/)
Create a clean landing page with:
- Logo: blue 56x56px rounded square with bold white "I"
- Title: "Insure!" (font-size 28px, font-weight 900)
- Subtitle: "외국인과 집주인이 함께 작성하는 안전한 주거 계약 서비스" (center aligned, color #8B95A1)
- Two role selection cards (max-width 360px, centered, flex-col gap-14px):

  Card 1 — Tenant (links to "/contract/demo" for now):
  - Badge: "임차인 (외국인)" — blue background (#EFF6FF), blue text (#1971C2)
  - Icon: 🌏 (32px)
  - Title: "외국인 임차인 화면" (18px, font-weight 800)
  - Description: "계약 조건 확인, 특약 AI 분석, 전자서명까지 단계별로 안내받으세요." (#8B95A1, 13px)
  - Border: 2px solid #BFDBFE on hover

  Card 2 — Landlord (links to "/landlord"):
  - Badge: "집주인 (임대인)" — green background (#ECFDF5), green text (#059669)
  - Icon: 🏠 (32px)
  - Title: "집주인 화면" (18px, font-weight 800)
  - Description: "매물 등록, 특약 입력, 임차인 초대 링크 생성 및 계약 진행 현황을 관리하세요." (#8B95A1, 13px)
  - Border: 2px solid #A7F3D0 on hover

## Supabase Schema
Create these two tables in Supabase:

Table: contracts
- id: uuid (primary key, default gen_random_uuid())
- created_at: timestamptz (default now())
- ll_name: text
- ll_id_num: text
- ll_phone: text
- ll_reg_no: text
- ll_address: text
- ll_address_detail: text
- ll_housing_type: text
- ll_area: text
- ll_floor: text
- ll_total_floor: text
- ll_deposit: text
- ll_monthly_rent: text
- ll_mgmt_fee: text
- ll_mgmt_includes: text[]
- ll_start_date: date
- ll_end_date: date
- ll_payment_day: text
- ll_tenant_name: text
- ll_tenant_phone: text
- contract_type: text (default 'A') — A=월세, B=전세, C=단기
- clauses: jsonb (array of {text: string, risk: string, explanation: string, suggestedAlternative: string})
- link_expires_at: timestamptz
- tt_name: text
- tt_nationality: text
- tt_id_num: text
- tt_phone: text
- tt_visa_type: text
- tt_signed: boolean (default false)
- tt_signed_at: timestamptz
- ll_signed: boolean (default false)
- ll_signed_at: timestamptz

Table: clause_requests
- id: uuid (primary key, default gen_random_uuid())
- created_at: timestamptz (default now())
- contract_id: uuid (foreign key → contracts.id)
- clause_index: integer
- message: text
- suggested_alternative: text
- status: text (default 'pending') — pending / accepted / rejected
- updated_clause: text
- responded_at: timestamptz

Enable Row Level Security on both tables.
Add policy: allow all operations for now (we'll tighten later).
Enable Realtime on clause_requests table.

## Shared Components to Build
Create these reusable components in /src/components/:

StatusTag: props = { label, color: 'green'|'yellow'|'red'|'blue'|'gray' }
- green: bg #EAFAF4, text #00A37A
- yellow: bg #FFF9E6, text #D48806
- red: bg #FFF0F0, text #E03131
- blue: bg #EFF6FF, text #1971C2
- gray: bg #F2F4F6, text #6B7684
- padding: 3px 10px, border-radius 8px, font-size 12px, font-weight 700

InfoRow: props = { label, value, valueStyle? }
- flex row, space-between, padding 12px 0, border-bottom 1px solid #F2F4F6
- label: 13px, #6B7684
- value: 13px, font-weight 600, #191F28, text-align right

ServiceHeader: props = { role: 'landlord'|'tenant', contractId? }
- sticky top-0, z-50, white background, border-bottom 1px solid #F2F4F6
- padding 14px 20px
- Logo "I" + "Insure!" + role badge (집주인 or 임차인)
- Right: contractId shown as "#id-short" in gray if provided
```

---

## 프롬프트 2 — 집주인 대시보드 + 새 계약 4단계 위저드

```
Add the landlord dashboard and 4-step new contract wizard to the existing Insure! app.

## Landlord Dashboard (/landlord)

Layout:
- ServiceHeader component (role="landlord")
- Bottom tab bar (fixed, white, border-top 1px #F2F4F6):
  - Tab 1: 🏠 대시보드 (active state: icon + label in #3182F6)
  - Tab 2: ➕ 새 계약 (links to /landlord/new)
  - Tab 3: 👤 내 정보 (disabled for now, show "준비 중" toast on tap)

Dashboard content:
- Header row: "내 계약 목록" (20px, font-weight 800) + "새 계약" primary button (links to /landlord/new, auto width, padding 10px 18px)
- Below name: "집주인님, 안녕하세요" (#8B95A1, 13px)
- Stats grid (3 columns, gap 10px):
  - Fetch from Supabase: count contracts where ll_signed=false AND tt_signed=false → "진행 중" (blue number)
  - count where ll_signed=true AND tt_signed=true → "완료" (green number)
  - count where tt_signed=true AND ll_signed=false → "서명 대기" (yellow number)
  - Each stat card: white, border-radius 14px, padding 14px 10px, text-center, number 22px font-weight 800, label 11px #8B95A1

- Contract list: fetch all contracts from Supabase ordered by created_at desc
  - Each contract card: white, border-radius 16px, padding 16px, margin-bottom 12px, border 1.5px #F2F4F6, clickable → /landlord/contract/:id
  - Show: address (ll_address + ll_address_detail), tenant name (tt_name or ll_tenant_name or "임차인 미정"), deposit (ll_deposit), contract period
  - Status tag based on: tt_signed+ll_signed=완료, tt_signed only=서명대기, else=진행중
  - Empty state: gray dashed border card with "아직 진행 중인 계약이 없습니다." and CTA button

## New Contract Wizard (/landlord/new)

State management: use React useState for all form fields and current step (1-4).

Step indicator (below ServiceHeader, sticky):
- 4 chips in a horizontal scroll row: ① 매물 정보 / ② 금액 조건 / ③ 특약조항 / ④ 초대 링크
- Active: bg #3182F6, white text
- Done: bg #EAFAF4, green text
- Inactive: bg #F2F4F6, gray text
- Border-radius 20px, padding 7px 14px, font-size 12px, font-weight 700

--- STEP 1: 매물 정보 ---
Title: "집주인 · 매물 정보 입력" / Sub: "계약서에 등록될 정보입니다."

Section card "집주인 본인 정보":
- 성명 (text input, id="ll_name")
- 주민등록번호 (text input, placeholder "000000-0000000", id="ll_id_num")
- 전화번호 (tel input, placeholder "010-0000-0000", id="ll_phone")
- 임대사업자 등록번호 (text input, placeholder "없으면 공란", id="ll_reg_no")

Section card "매물 정보":
- 도로명 주소 (text input, id="ll_address")
- 상세 주소 (text input, placeholder "302호", id="ll_address_detail")
- 2-column grid:
  - 주택 유형 (select: 원룸/투룸/오피스텔/아파트/빌라/연립주택/다세대주택/다가구주택, id="ll_housing_type")
  - 전용면적 (text input, placeholder "33㎡", id="ll_area")
- 2-column grid:
  - 해당 층 (number input, id="ll_floor")
  - 건물 전체 층 (number input, id="ll_total_floor")
- 계약 유형 (3 toggle buttons): 월세(A) / 전세(B) / 단기(C)
  - Selected: border 2px #3182F6, bg #EFF6FF, text #1971C2, font-weight 700
  - Unselected: border 2px #E8EAED, bg white, text #8B95A1

Bottom buttons: [취소 (secondary, go to /landlord)] [다음 (primary flex-2)]

--- STEP 2: 금액 조건 ---
Title: "금액 조건 입력" / Sub: "정확하게 입력하세요. 계약서에 그대로 반영됩니다."

Section card:
- 보증금: text input with "원" suffix, placeholder "50,000,000", id="ll_deposit"
  - Helper: "예: 5천만원 → 50,000,000"
- 월세: text input with "원" suffix, id="ll_monthly_rent"
- 관리비: text input with "원" suffix, id="ll_mgmt_fee"
  - Below: 4 toggle chips (multi-select): 인터넷 / TV / 청소 / 경비
  - Selected: border #93C5FD, bg #EFF6FF, text #1971C2
  - Store as array in ll_mgmt_includes
- 계약 시작일: date input, id="ll_start_date"
- 계약 종료일: date input, id="ll_end_date"
- 월세 납부일: select (매월 1일/5일/10일/15일/25일), id="ll_payment_day"

Bottom buttons: [이전 (secondary)] [다음 (primary flex-2)]

--- STEP 3: 특약조항 ---
Title: "특약조항 입력" / Sub: "입력 즉시 AI가 임차인 관점에서 분석합니다."

State: clauses = array of { text, risk, explanation, suggestedAlternative }
risk values: 'safe' | 'warn' | 'danger'

Display existing clauses as cards (background #F9FAFB, border-radius 12px, padding 14px, margin-bottom 10px, border 1.5px #F2F4F6):
- Top row: "특약 N" label (gray) + delete button (red, text only)
- Clause text (14px, #191F28)
- AI hint box below text:
  - danger: bg #FFF8F8, border 1px #FFD0D0, text #B91C1C — "🔴 AI 검토 권장 — {explanation}"
  - warn: bg #FFFDF0, border 1px #FFE9A0, text #92650A — "🟡 AI 확인 필요 — {explanation}"
  - safe: bg #F0FFF9, border 1px #C8F5EB, text #007A58 — "🟢 AI 일반 조항 — {explanation}"

Add new clause section (card):
- textarea (3 rows, placeholder "예: 임차인은 흡연을 금지한다.", id="newClause")
- AI preview area: show loading spinner while analyzing, then show result
- "AI 분석 후 추가" secondary button (sm):
  - On click: POST to /api/analyze-clause with { clause: newClause value }
  - Show loading state on button
  - On response: show preview of risk + explanation in the preview area
  - If user confirms (show "이 특약 추가" confirm button), push to clauses array and clear textarea

Recommended templates section (blue bg card):
- Title: "추천 특약 템플릿"
- 3 buttons: "전대차 금지" / "원상복구" / "인테리어 제한"
- On click: set newClause to template text and auto-trigger analysis

Create /api/analyze-clause edge function (Supabase edge function or use a Supabase RPC):
- Input: { clause: string }
- Call Anthropic Claude API (claude-haiku-4-5-20251001) with this system prompt:
  "당신은 한국 임대차 계약 특약 리스크 분석 전문가입니다. 임차인 관점에서 특약을 분석하고 JSON만 반환하세요."
- User prompt: "특약 분석: {clause}\n반환 형식: {\"risk\":\"safe|warn|danger\",\"explanation\":\"한국어 2문장\",\"suggestedAlternative\":\"위험할 경우 대안 조항, 안전하면 빈 문자열\"}"
- Return the parsed JSON
- Note: API key comes from environment variable ANTHROPIC_API_KEY. Do NOT hardcode it.

Bottom buttons: [이전 (secondary)] [임차인 초대하기 (primary flex-2)]

--- STEP 4: 초대 링크 ---
On entering step 4:
- Call Supabase to INSERT a new contract record with all collected data (ll_* fields + clauses array)
- Store the returned contract id in state

Display:
- Success header card: ✅ icon + "계약서 초안 완성!" + "임차인 서명만 남았어요"
- "초대 링크" label
- Link box (bg #EFF6FF, border 1.5px dashed #93C5FD, border-radius 14px, padding 14px 16px):
  - Show full URL: {window.location.origin}/contract/{contractId}
  - word-break: break-all
- 2 buttons: [링크 복사 (secondary sm, uses navigator.clipboard)] [카카오 공유 (yellow sm)]
  - Kakao share: use Kakao JavaScript SDK if available, else fallback to copy link with toast "링크가 복사되었습니다"

Link settings card (gray bg):
- 유효 기간 select: 7일 / 14일 / 30일
  - On change: PATCH the contract with link_expires_at = now + selected days
- 접근 비밀번호: "설정하기" button (show "준비 중" toast for now)

Pre-fill tenant info card:
- 임차인 이름 input (ll_tenant_name)
- 연락처 input (ll_tenant_phone)
- "저장" button → PATCH contract with these fields

Action buttons (stacked, full width):
- "계약 현황 확인하기" (primary) → navigate to /landlord/contract/{contractId}
- "대시보드로 돌아가기" (secondary) → navigate to /landlord
```

---

## 프롬프트 3 — 집주인 계약 상세 + 임차인 플로우 STEP 1~4

```
Add the landlord contract detail page and the first 4 steps of the tenant contract flow.

## Landlord Contract Detail (/landlord/contract/:id)

Fetch contract from Supabase by id on load. Also subscribe to Supabase Realtime on clause_requests table filtered by contract_id = this id.

Layout:
- ServiceHeader (role="landlord")
- Back button (←, circle 36px, bg #F2F4F6) + "계약 상세" title + status tag
  - Status: tt_signed && ll_signed = StatusTag("완료", "green") / tt_signed only = StatusTag("서명 대기", "yellow") / else = StatusTag("진행 중", "blue")

Section 1 — 공동작성 타임라인 (card):
Title: "공동작성 현황"
Show 7 timeline items. Each item:
- Left: dot icon (28px circle) — done=green bg with ✓, active=yellow border with pulse dot, pending=gray
- Center: step title + subtitle (date or "대기 중...")
- Right: status tag or empty

Timeline steps (evaluate based on contract data):
1. 매물 정보 입력 — always done (집주인 완료)
2. 특약조항 입력 — done if clauses.length > 0
3. 임차인 개인정보 입력 — done if tt_name is not null
4. 임차인 계약 내용 확인 — done if tt_name is not null (same condition for now)
5. 특약 검토 및 수정 요청 — show clause_requests count as subtitle if any
6. 보증금 위험도 확인 — done if tt_signed (means they saw it before signing)
7. 임차인 서명 — done if tt_signed, pending otherwise
8. 집주인 서명 + PDF — done if ll_signed, pending if tt_signed, locked otherwise

Section 2 — 수정 요청 알림 (show only if clause_requests with status='pending' exist):
- Card with yellow border (#FEF3C7), bg #FFFBEB
- "임차인이 특약 수정을 요청했습니다 (N건)" (font-weight 700, #92400E)
- List each pending request: clause_index, tenant message, suggested alternative
- Per request: [수정 반영 (primary sm)] [거절 (danger sm)]
  - On 수정 반영: show modal with textarea pre-filled with suggestedAlternative (or original clause)
    - Confirm: PATCH clause_requests/{id} with status='accepted', updated_clause=textarea value
    - Then PATCH contracts/{id}: update clauses[clause_index] with new text and re-run AI analysis
  - On 거절: PATCH clause_requests/{id} with status='rejected', responded_at=now()
- Realtime: when clause_requests changes, refresh this section automatically

Section 3 — 계약 정보 요약 (card):
InfoRow components for: 주소 / 임차인 / 보증금+월세 / 계약기간 / 특약 수 및 등급 분포

Section 4 — 집주인 서명 영역 (card, blue border):
- If tt_signed is false: "임차인 서명 완료 후 활성화됩니다" (grayed out)
- If tt_signed is true: 
  - "임차인이 서명을 완료했습니다. 집주인 서명 후 계약이 최종 완료됩니다."
  - "지금 서명하기" primary button → navigate to /landlord/contract/:id/sign (placeholder for now)

Bottom action buttons:
- [계약서 수정 (secondary sm)] — show "계약서 수정은 임차인 서명 전까지 가능합니다" toast
- [계약 취소 (danger sm)] — show confirm dialog "정말 취소하시겠습니까?" → if confirmed, could mark as cancelled (add status field logic if needed)

## Tenant Contract Flow (/contract/:id)

Fetch contract from Supabase by id on load (show loading spinner while fetching).
If contract not found: show error page "유효하지 않은 계약 링크입니다."

State: currentStep (1-7), tenantData (form fields)

Layout:
- ServiceHeader (role="tenant", contractId=id)
- Progress bar (sticky below header):
  - 5 numbered circles: 확인 / 내정보 / 조건 / 특약 / 보증금 / 서명
  - Step circle: done=green ✓, active=blue number, inactive=gray number
  - Lines between: filled blue if done, gray otherwise
  - Current step label in blue below the bar
  - Bottom hint: "N단계 / 6단계 — {stepName}"

--- STEP 1: 계약서 확인 ---
Card:
- Top: 🏠 icon + "새 계약 초대" label + "계약서를 확인해 주세요"
- Blue info box: contract address (ll_address + ll_address_detail) + housing type
- InfoRows: 집주인 ({ll_name}) / 계약 유형 ({contract_type === 'A' ? '월세' : contract_type === 'B' ? '전세' : '단기'})

Primary button: "시작하기" → go to step 2

--- STEP 2: 내 정보 입력 ---
Title: "내 정보를 입력해 주세요" / Sub: "계약서에 등록될 정보입니다. 여권과 동일하게 입력하세요."

Card with inputs:
- 이름 (여권 기준): text input, placeholder "홍길동 / Hong Gil-dong", id="tt_name"
- 국적: select with options: 중국 (China) / 미국 (USA) / 베트남 (Vietnam) / 필리핀 (Philippines) / 태국 (Thailand) / 인도 (India) / 기타 (Other)
- 등록 외국인번호 / 여권번호: text input, id="tt_id_num"
- 연락처: tel input, id="tt_phone"
- 체류 자격: select: D-2 (유학) / E-7 (특정활동) / F-2 (거주) / F-4 (재외동포) / H-2 (방문취업) / F-6 (결혼이민) / 기타

Info banner (yellow bg #FFFBEB, border #FEF3C7):
- 💡 "체류 자격이 중요한 이유"
- "체류 자격에 따라 계약 가능 여부와 전입신고 방법이 달라집니다." (#B45309, 12px)

Buttons: [이전] [저장하고 다음 (primary flex-2)]
Validation: tt_name, tt_id_num, tt_phone required before proceeding

--- STEP 3: 계약 조건 확인 ---
Title: "계약 조건을 확인해 주세요" / Sub: "집주인이 입력한 내용입니다."

Card "📍 임차 주택 정보":
InfoRows: 주소 / 주택 유형 / 층수 ({ll_floor}층 / {ll_total_floor}층)

Card "💰 금액 조건":
- 보증금 row: label + sub "계약 시 납부하는 목돈" / value in blue, 18px bold
- 월세 row: label + sub "매달 납부하는 금액" / value 18px bold
- 관리비 row: label + sub "건물 공용부분 유지비" / value
- 계약 기간 row: "{ll_start_date} ~ {ll_end_date}"
- 납부일 row: {ll_payment_day}

Card "📋 공동작성 현황":
- Landlord row: 🏠 avatar + "집주인 ({ll_name})" + "매물 정보 입력 완료" + StatusTag("✓ 완료", "green")
- Tenant row: 👤 avatar + "임차인 (나)" + "개인정보 입력 완료" + StatusTag("진행 중", "blue")

Buttons: [이전] [특약 확인하기 (primary flex-2)]

--- STEP 4: 특약조항 확인 + 수정 요청 ---
Title: "특약조항을 확인해 주세요" / Sub: "AI가 각 조항을 분석했어요. 위험 조항은 집주인과 꼭 협의하세요."

Also subscribe to Supabase Realtime on clause_requests where contract_id = id AND relevant to tenant. When a request's status changes (accepted/rejected), refresh the clause display.

Summary banner:
- Count clauses by risk and display
- If any 'danger': red border card with ⚠️ "검토 필요 조항이 있습니다"
- If all safe: green border card with ✅ "모든 조항이 안전합니다"
- Show count chips: 🔴 N / 🟡 N / 🟢 N

Per clause card (use contract.clauses array):
Risk-based card style:
- danger: bg #FFF8F8, border 1.5px #FFD0D0
- warn: bg #FFFDF0, border 1.5px #FFE9A0
- safe: bg #F8FFFE, border 1.5px #C8F5EB

Card content:
- Top row: risk tag (🔴 검토 권장 / 🟡 확인 필요 / 🟢 일반 조항) + "특약 N" label
- Clause text (14px, font-weight 600)
- AI analysis box (white bg, inner border matching risk):
  - AI badge (colored circle) + "AI 분석 결과" label
  - explanation text
- If risk=danger AND suggestedAlternative exists: show suggested alternative in a separate box
- "수정 요청" button (shown for danger always, for warn optionally):
  - Look up clause_requests for this clause_index:
    - If pending: show "요청 중..." badge (yellow)
    - If accepted: show "수정 완료" badge (green) and display updated_clause
    - If rejected: show "거절됨" badge (red) + "위험 인지 후 진행" checkbox option
    - If none: show "수정 요청" button

수정 요청 flow (when button clicked):
- Show inline expansion (not modal) below the clause card:
  - Title: "집주인에게 수정 요청"
  - If suggestedAlternative exists: radio options — "AI 제안 대안 조항 사용" (pre-fill text) or "직접 입력"
  - Textarea for message (placeholder: "예: 이 조항의 구체적인 조건을 명시해 주세요.")
  - [취소] [요청 보내기] buttons
  - On submit: INSERT into clause_requests {contract_id, clause_index, message, suggested_alternative}
  - Show success: "요청이 전송되었습니다. 집주인의 응답을 기다리고 있어요."

Help banner at bottom:
- 📞 "도움이 필요하신가요?" + "외국인 주거 무료 법률 상담" + "외국인종합안내센터 ☎ 1345" (blue, clickable tel link)

Next button condition:
- If any 'danger' clause has no resolved request (accepted or "인지 후 진행" checked): show warning toast "검토 필요 조항을 확인해 주세요"
- Otherwise: proceed to step 5
- Button text: "확인하고 다음" (primary)
```

---

## 프롬프트 4 — 임차인 STEP 5~7 (보증금 위험도 + 서명 + 완료)

```
Add the final 3 steps of the tenant flow: deposit risk analysis (before signing), electronic signature (last step), and completion screen.

## STEP 5: 보증금 위험도 분석

On entering step 5, automatically call the deposit analysis API.

Title: "보증금 위험도 분석" / Sub: "서명 전 이 지역 실거래가를 기준으로 보증금이 적절한지 확인합니다."

Loading state (shown while API call is in progress):
- Spinner animation
- "AI가 이 지역 실거래가 데이터를 분석하고 있습니다..." (14px, #8B95A1)
- "최대 15초 소요될 수 있습니다."

API Call: POST to /api/analyze-deposit with:
{ address: contract.ll_address, deposit: contract.ll_deposit, housing_type: contract.ll_housing_type }

Create this Supabase edge function /api/analyze-deposit:
- Extract LAWD_CD from address using this mapping (partial — expand as needed):
  서울특별시 구별 코드:
  종로구=11110, 중구=11140, 용산구=11170, 성동구=11200, 광진구=11215,
  동대문구=11230, 중랑구=11260, 성북구=11290, 강북구=11305, 도봉구=11320,
  노원구=11350, 은평구=11380, 서대문구=11410, 마포구=11440, 양천구=11470,
  강서구=11500, 구로구=11530, 금천구=11545, 영등포구=11560, 동작구=11590,
  관악구=11620, 서초구=11650, 강남구=11680, 송파구=11710, 강동구=11740
  (Add more cities as needed from the existing api/analyze.js reference)

- Determine endpoint based on housing_type:
  아파트 → RTMSDataSvcAptRent/getRTMSDataSvcAptRent
  오피스텔 → RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent
  else → RTMSDataSvcRHRent/getRTMSDataSvcRHRent

- Fetch last 3 months of transaction data from 국토부 API (env var: DATA_GO_KR_KEY)
  URL pattern: https://apis.data.go.kr/1613000/{endpoint}?LAWD_CD={lawdCd}&DEAL_YMD={yyyyMM}&serviceKey={key}&numOfRows=100
  Parse XML response, extract 'deposit' field values (in 만원 units), calculate median

- Call Claude Haiku with analysis prompt (env var: ANTHROPIC_API_KEY):
  System: "당신은 한국 임대차 보증금 리스크 분석 전문가입니다."
  User: "아래 계약 정보를 분석하고 JSON만 반환하세요.
  주소: {address}, 주택유형: {housing_type}, 보증금: {deposit}원
  지역 거래 중앙값: {medianManWon}만원 ({sampleCount}건)
  비율: {ratio}%
  반환: {\"risk\":\"safe|warn|danger|unknown\",\"riskLabel\":\"안전|주의|고위험|확인필요\",\"message\":\"2-3문장 한국어 분석\"}"

- Fallback if Claude fails or no data:
  ratio ≤ 110%: safe / ratio ≤ 130%: warn / ratio > 130%: danger / no data: unknown

- Return: { riskLabel, riskColor, message, medianDeposit, sampleCount, ratio }

Result display (after loading):

Risk result card:
- Border and background color based on risk:
  safe: border #C8F5EB, bg #F8FFFE
  warn: border #FFE9A0, bg #FFFDF0
  danger: border #FFD0D0, bg #FFF8F8
  unknown: border #E8EAED, bg #F9FAFB

- Top row: "보증금 위험도 분석" title + risk badge ({riskLabel} in corresponding color, pill shape)
- Analysis message (14px, #374151, line-height 1.65)
- If sampleCount > 0: sub info "지역 중앙값 {medianDeposit}만원 기준 ({sampleCount}건 거래 분석)"
- Divider

Risk-specific guidance card below:
- safe: 
  - "이 보증금은 지역 시세 범위 내입니다." (green text)
  - Checklist: ✓ 등기부등본 선순위 채권 확인 / ✓ 확정일자 신청 예정 / ✓ 전입신고 일정 확인
  - CTA button: "안심하고 서명 단계로" (primary)

- warn:
  - "주의가 필요합니다. 아래 사항을 반드시 확인하세요." (yellow text)
  - Action list with checkboxes (user must check all to proceed):
    ☐ 등기부등본에서 선순위 근저당을 확인했습니다
    ☐ 확정일자를 신청할 예정입니다
  - Link: "등기부등본 조회 →" (link to www.iros.go.kr, opens new tab)
  - CTA: "확인했습니다, 서명 단계로" (primary, enabled only when all checked)

- danger:
  - ⚠️ "보증금이 시세보다 현저히 높습니다. 서명 전 전문가 상담을 강력 권장합니다." (red, font-weight 700)
  - Warning box with: "전세사기 위험이 있을 수 있습니다. 계약 전 아래 사항을 확인하세요."
  - Mandatory checkboxes (ALL required to proceed):
    ☐ 등기부등본 선순위 채권을 직접 확인했습니다 (또는 공인중개사를 통해 확인 예정)
    ☐ 위험성을 인지하고 있으며, 본인 판단으로 계약을 진행합니다
  - Emergency contacts:
    - 외국인종합안내센터 ☎ 1345 (tel link)
    - 전세피해지원센터 ☎ 1588-2188 (tel link)
  - CTA: "위험성을 인지하고 서명 단계로" (danger style button, enabled only when all checked)

- unknown:
  - "해당 지역의 실거래 데이터가 없어 비교가 어렵습니다."
  - "직접 시세를 확인해 주세요." with link to 국토부 실거래가 공개시스템
  - CTA: "직접 확인 후 서명 단계로" (secondary)

Back button: [이전] at bottom (secondary)

## STEP 6: 최종 확인 및 서명 (마지막)

Title: "최종 확인 및 서명" / Sub: "아래 내용을 확인하고 서명해 주세요. 서명 후 계약의 법적 효력이 발생합니다."

Card — 계약 최종 요약:
- Title: "계약 최종 요약"
- InfoRows: 주소 / 보증금 (blue, bold) / 월세 / 계약기간 / 임차인 (tt_name) / 임대인 (ll_name)

Card — 특약 및 위험도 요약:
- "특약 {clauses.length}개" with risk distribution chips (🔴N 🟡N 🟢N inline)
- "보증금 위험도: {riskLabel from step 5}" with color badge
- Small text: "이전 단계에서 확인하셨습니다"

Card — 위험 조항 인지 확인 (red border, red bg):
- Title: ⚠️ "서명 전 마지막 확인"
- For each 'danger' clause: individual checkbox
  "특약 N ({clause text truncated to 20 chars}...)의 위험성을 인지하고 동의합니다."
- For all 'warn' clauses combined (if any): one checkbox
  "주의 필요 조항({count}개)의 내용을 충분히 이해했습니다."

Card — 전자서명:
- Title: "전자서명"
- Sub: "아래 박스에 손가락으로 서명해 주세요"
- Canvas element (height 130px, border 1.5px dashed #D1D5DB, border-radius 14px, bg #FAFAFA):
  - Support both touch events (touchstart/touchmove) and mouse events
  - Show "여기에 서명하세요" placeholder when empty
  - Store signed state (boolean) and canvas data URL
  - "서명 지우기" text button below (small, underlined, gray)
- Implement canvas drawing: strokeStyle #191F28, lineWidth 2.5, lineCap round, lineJoin round
- Handle devicePixelRatio for crisp rendering

Card — 전체 동의:
- Single checkbox: "위의 계약 내용을 모두 확인하였으며 동의합니다. 전자서명은 자필 서명과 동일한 법적 효력을 가집니다."

Submit button: "서명 완료 및 제출" (primary, full width)
- Disabled state: any required checkbox unchecked OR no signature drawn
- On click validation: check all danger checkboxes + ckAll + signed
- If validation passes:
  - Get canvas data URL: canvas.toDataURL()
  - PATCH /api/contracts/:id with: { tt_name, tt_nationality, tt_id_num, tt_phone, tt_visa_type, tt_signed: true, tt_signed_at: new Date().toISOString() }
  - Navigate to step 7
- Show toast errors for missing items

Back button: [이전으로 돌아가기 (secondary)] at bottom

## STEP 7: 완료

Layout (centered, padding top 40px):
- Large check circle: 80px, bg #ECFDF5, ✅ emoji (40px)
- "서명 완료!" (24px, font-weight 800)
- "집주인의 서명을 기다리고 있어요.\n서명이 완료되면 알림을 드릴게요." (14px, #8B95A1, line-height 1.7)

Progress status card:
- Tenant row: ✓ green circle + "임차인 서명 완료" + StatusTag("완료", "green")
- Landlord row: gray pulse dot circle + "임대인 서명 대기 중" + StatusTag("대기", "gray")
- Subscribe to Supabase Realtime on contracts where id = contractId
  - When ll_signed becomes true: update landlord row to show ✓ + "완료"
  - Show new section: "🎉 계약이 최종 완료되었습니다!"

Notice card (blue bg):
- "등기부등본 선순위 채권을 확인하셨나요?"
- "전입신고는 입주 당일 바로 신청하세요."
- "확정일자는 주민센터 또는 인터넷등기소에서 받으세요."

Help card:
- 외국인종합안내센터 ☎ 1345 (tel link, blue)
```

---

## 프롬프트 5 — 환경변수 연동 + 오류 처리 + 엣지케이스 + 최종 polish

```
Polish the Insure! app with proper error handling, loading states, edge cases, and production readiness.

## Environment Variables
Ensure the following env vars are referenced (never hardcoded):
- ANTHROPIC_API_KEY — for Claude API calls
- DATA_GO_KR_KEY — for 국토부 실거래가 API
- VITE_SUPABASE_URL — Supabase project URL
- VITE_SUPABASE_ANON_KEY — Supabase anon key

## Global Error Handling

1. API Error Toast System:
Create a global toast notification component (bottom-center, z-50):
- Success: green bg, ✓ icon
- Error: red bg, ✗ icon  
- Info: blue bg, ℹ icon
- Warning: yellow bg, ⚠ icon
- Auto dismiss after 3 seconds
- Show on: copy success, API errors, form validation failures, Supabase errors

2. Network Error Boundaries:
- If Supabase fetch fails on /contract/:id: show full-page error "계약 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요." with retry button
- If contract not found: "유효하지 않은 계약 링크입니다. 집주인에게 새 링크를 요청해 주세요."
- If link_expires_at is in the past: "이 계약 링크가 만료되었습니다. 집주인에게 새 링크를 요청해 주세요."

3. API Timeout Handling:
- Claude API calls: if no response within 15 seconds, show "AI 분석 중 문제가 발생했습니다. 다시 시도해 주세요." with retry button
- 국토부 API: if fails or returns no data, gracefully show "해당 지역 실거래 데이터를 찾을 수 없습니다. 직접 시세를 확인해 주세요." — do NOT block user from proceeding

## Loading States

Add skeleton loaders for:
- Dashboard contract list: show 3 skeleton cards while loading
- Contract detail: skeleton for each section while fetching
- Tenant step 1: show skeleton for address/landlord info boxes
- Step 5 deposit analysis: existing spinner + progress message (already defined in prompt 4)

## Form Validation

Landlord new contract:
- STEP 1: ll_name, ll_address required. Show inline error below field if empty on "다음" click. Red border on invalid field.
- STEP 2: ll_deposit required. Format number with commas as user types (use toLocaleString). Validate ll_start_date < ll_end_date (show error if not).
- STEP 3: No required fields (clauses can be empty — show warning toast "특약이 없으면 표준 계약 조건이 적용됩니다" if empty, but allow proceeding)

Tenant flow:
- STEP 2: tt_name, tt_id_num, tt_phone all required. Phone: validate Korean format (010-XXXX-XXXX) or allow any format with min 9 chars.
- STEP 6: All danger clause checkboxes + ckAll + signature required (already enforced — verify implementation)

## Mobile UX Polish

1. Input fields on mobile:
- All number inputs: add inputMode="numeric" 
- Phone inputs: add inputMode="tel"
- Date inputs: use type="date" (native mobile picker)
- Prevent zoom on input focus: ensure font-size ≥ 16px on all inputs

2. Touch interactions:
- All clickable elements: add -webkit-tap-highlight-color: transparent
- Active states: slightly darken background on tap
- Bottom safe area: add padding-bottom: env(safe-area-inset-bottom, 0px) to fixed bottom bars

3. Scrolling:
- Step indicator horizontal scroll: hide scrollbar (scrollbar-width: none)
- Long page content: smooth scroll to top on step change (window.scrollTo({ top: 0, behavior: 'smooth' }))

## Edge Cases

1. Duplicate submission prevention:
- Disable submit buttons immediately on click, re-enable on error
- Add loading spinner inside button while submitting
- Prevent double-tap on mobile by adding pointer-events: none after first tap

2. Clause request conflicts:
- If tenant submits a request for a clause that already has a pending request: show "이미 수정 요청 중입니다" and show existing request status instead

3. Already-signed contracts:
- If tenant accesses /contract/:id and tt_signed is already true: skip to STEP 7 directly, show "이미 서명이 완료된 계약입니다"
- If both signed: show completion message with PDF notice

4. Empty clauses array:
- In tenant STEP 4: show "집주인이 특약을 입력하지 않았습니다. 표준 계약 조건이 적용됩니다." info card, allow proceeding directly

5. Missing 국토부 data:
- If LAWD_CD not found for the address: show "입력된 주소에서 지역 코드를 확인할 수 없습니다. 아래 링크에서 직접 시세를 확인해 주세요." and show CTA to proceed with acknowledgment

## Final UI Polish

1. Page transitions: add subtle fade-in animation on step change
   (opacity 0 → 1, translateY 6px → 0, duration 200ms ease)

2. Responsive layout: ensure all content stays within max-width 480px on mobile, centered on desktop with gray sidebar

3. Number formatting:
- Display ll_deposit, ll_monthly_rent, ll_mgmt_fee with Korean number formatting:
  - If value contains commas: display as-is
  - Parse to number and format: values over 10000 show as "X,XXX만원", else "X원"
  - On InfoRow display: always show formatted version

4. Accessibility:
- All form inputs have associated labels
- Buttons have meaningful aria-labels
- Error states use aria-invalid and aria-describedby

5. Contract type display:
- A (월세): show both 보증금 and 월세 fields
- B (전세): show only 보증금 field (hide 월세/관리비 sections)
- C (단기): show 보증금, 월세, and note "단기 계약"

6. Final check on Supabase Realtime:
- Verify clause_requests realtime subscription is properly cleaned up on component unmount (useEffect cleanup)
- Verify contracts realtime subscription in tenant STEP 7 works correctly
- Both subscriptions should use specific filters (eq: contract_id = id) to avoid unnecessary data transfer

## Production Checklist
Before finalizing, ensure:
- [ ] No hardcoded API keys anywhere in frontend code
- [ ] No mock/dummy data anywhere — all data comes from Supabase or real API calls
- [ ] All API calls have error handling and user-facing error messages
- [ ] Loading states exist for all async operations
- [ ] Mobile touch events work on canvas signature pad
- [ ] Form validation prevents empty submissions
- [ ] Supabase RLS policies are in place
```

---

## 프롬프트 사용 순서 요약

| 순서 | 프롬프트 | 핵심 산출물 |
|---|---|---|
| **1** | 기반 + 디자인 + 랜딩 + Supabase 스키마 | 공통 컴포넌트, 라우팅, DB 구조 확정 |
| **2** | 집주인 대시보드 + 새 계약 4단계 | 집주인 플로우 전체, 특약 AI 분석 API |
| **3** | 집주인 계약 상세 + 임차인 STEP 1~4 | 수정 요청 기능, Realtime 연동 |
| **4** | 임차인 STEP 5~7 | 보증금 위험도 API, 전자서명, 완료 화면 |
| **5** | 오류 처리 + 엣지케이스 + 최종 polish | 프로덕션 품질 완성 |

## 주의사항

- 각 프롬프트는 이전 프롬프트의 결과물이 정상 동작하는 상태에서 입력할 것
- 프롬프트 2 이후부터는 Lovable 화면에서 "이전에 만든 Insure! 프로젝트에 아래 기능을 추가해줘" 형태로 이어서 입력
- ANTHROPIC_API_KEY, DATA_GO_KR_KEY는 Lovable의 Supabase Edge Functions 환경변수에 등록 필요
- 분석 기준 데이터(특약 판단 기준 등)는 별도로 프롬프트에 추가 예정
