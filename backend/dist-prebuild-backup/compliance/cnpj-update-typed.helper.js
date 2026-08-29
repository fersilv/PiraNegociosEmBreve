"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyTypedCnpjCompanyUpdate = applyTypedCnpjCompanyUpdate;
async function applyTypedCnpjCompanyUpdate(dataSource, companyId, input) {
    return dataSource.query(`WITH input AS (
       SELECT
         $1::uuid AS company_id,
         $2::text AS cnpj,
         $3::text AS legal_name,
         $4::text AS trade_name,
         $5::text AS legal_address,
         $6::text AS legal_city,
         $7::text AS legal_state,
         $8::text AS legal_zip,
         $9::text AS situation,
         $10::text AS source,
         $11::timestamptz AS source_updated_at,
         $12::jsonb AS snapshot,
         $13::jsonb AS change_alert,
         $14::boolean AS commercial_same
     )
     UPDATE companies c SET
       "hasCnpj"=true,
       cnpj=i.cnpj,
       "legalName"=i.legal_name,
       "registryTradeName"=i.trade_name,
       "legalAddress"=i.legal_address,
       "legalCity"=i.legal_city,
       "legalState"=i.legal_state,
       "legalZipCode"=i.legal_zip,
       "cnpjSituation"=i.situation,
       "cnpjDataSource"=i.source,
       "cnpjDataCheckedAt"=now(),
       "cnpjDataUpdatedAt"=i.source_updated_at,
       "cnpjSnapshot"=i.snapshot,
       "cnpjChangeAlert"=i.change_alert,
       address=CASE WHEN i.commercial_same THEN i.legal_address ELSE c.address END,
       city=CASE WHEN i.commercial_same THEN i.legal_city ELSE c.city END,
       state=CASE WHEN i.commercial_same THEN i.legal_state ELSE c.state END,
       "cityState"=CASE WHEN i.commercial_same THEN concat_ws(', ',NULLIF(i.legal_city,''),NULLIF(i.legal_state,'')) ELSE c."cityState" END,
       "updatedAt"=now()
     FROM input i
     WHERE c.id=i.company_id
     RETURNING c.*`, [
        companyId,
        input.cnpj,
        input.legalName,
        input.tradeName,
        input.legalAddress,
        input.city,
        input.state,
        input.zipCode,
        input.situation,
        input.source,
        input.sourceUpdatedAt,
        input.snapshot,
        input.changeAlert,
        input.commercialSame,
    ]);
}
//# sourceMappingURL=cnpj-update-typed.helper.js.map