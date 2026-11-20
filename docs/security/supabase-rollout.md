# 보안 매물장 적용 절차 (운영 데이터 보존)

1. Supabase 프로젝트 `bnciuadsqytgjqhqfwht`의 SQL Editor에서 기존 테이블 존재 여부와 RLS 정책을 확인한다. 기존 이름과 충돌하거나 데이터가 있으면 중단하고 검토한다.
2. `20261120_secure_ledger_foundation.sql`, `20261120_secure_ledger_access.sql`, `20261120_secure_ledger_hardening.sql`을 순서대로 적용한다. 스키마 마이그레이션에는 개인정보 삭제 구문이 없다.
3. Authentication에서 대표자와 직원의 계정을 각각 생성한다. 대표자는 아래 쿼리를 SQL Editor에서 **실제 인증 이메일로 교체**하여 승인한다. 이메일은 소스코드나 공개 저장소에 저장하지 않는다.

```sql
INSERT INTO public.hb_staff_memberships(user_id,role,active)
SELECT id,'admin',true FROM auth.users WHERE email = '<대표자 이메일>'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', active = true;
```

직원은 같은 쿼리에서 `'staff'`, `<직원 이메일>`을 사용한다. 직원에게는 자신에게 배정된 매물만 보인다. 처음 연결할 때 대표자가 공개 매물번호를 선택하고 담당 직원 ID를 지정한다. 비공개 연락처는 별도 화면에서만 입력한다.

4. SQL Editor에서 `SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname LIKE 'hb_%';`를 실행해 RLS 활성화를 확인한다. 관리자·직원·미승인 계정·익명 계정으로 PostgREST 요청을 각각 직접 시험한다. 익명 조회/쓰기, 미승인 조회/쓰기, 타 직원 매물 조회/쓰기와 삭제가 거부되어야 한다. 허용된 직원은 자신에게 할당된 매물만 조회/수정할 수 있어야 한다. 가짜 이름과 전화번호만 사용하고 테스트 후 실제 개인정보와 혼합하지 않는다.
5. 공개 매물번호 연결 및 수정 테스트 후 PC와 모바일에서 로그인, 재접속, 로그아웃, 홈페이지와 3D 도면, 피클의 GitHub → Pages 자동 등록을 확인한다. 새 공개 매물은 DB에서 자동 생성되지 않으며 대표자가 매물번호를 연결한다. 기존 로컬 연락처와 암호화 파일은 별도 안전한 이전 검증 전까지 보존한다.
6. 공개 저장소의 `shareal/app.js`에 직원 PIN이 하드코딩되어 있고 `shareal/secure/private.enc.json`은 누구나 다운로드 가능하다. 기존 PIN은 유출된 것으로 간주하고 별도 안전한 전환 후 폐기한다. 암호화 파일은 공개 이력에도 남으므로 단순 삭제만으로 노출이 해결되지 않는다. 전환 전에 암호의 강도, 배포 기록, 복호화 및 복원 가능성, 비밀번호 공유 범위를 점검해야 한다. 암호화 비밀번호를 채팅이나 GitHub에 입력하지 않는다.

운영 사이트의 기존 PIN 매물장은 권한 통제 수단으로 신뢰할 수 없다. 새 보안 DB에 들어간 연락처는 기존 매물장의 로컬 연락처 화면에 자동 반영되지 않는다. 기존 자료를 지우거나 기존 암호화 자료를 새 DB로 일괄 이전하는 코드는 포함하지 않는다.
