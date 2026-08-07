-- Temporarily disable the guard trigger to allow privileged update
ALTER TABLE sales_people DISABLE TRIGGER trg_guard_sales_people_privileged_columns;

UPDATE sales_people SET is_active = false WHERE id = '920a9a27-8b65-4e5c-ad61-5b8598470176';

-- Re-enable the guard trigger
ALTER TABLE sales_people ENABLE TRIGGER trg_guard_sales_people_privileged_columns;
