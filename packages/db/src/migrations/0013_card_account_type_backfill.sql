-- Credit/charge cards were folded into the CASH canonical type before CARD
-- existed. Reclassify them from the raw provider type preserved in metadata;
-- balance values are untouched (they stay provider-convention: positive =
-- amount owed).
UPDATE "financial_accounts"
SET "type" = 'CARD'
WHERE "type" = 'CASH'
  AND "metadata" ->> 'truelayerAccountType' IN ('CREDIT_CARD', 'CHARGE_CARD');
