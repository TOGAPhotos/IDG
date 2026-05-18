CREATE OR REPLACE SQL SECURITY INVOKER VIEW `observation_log_info` AS
SELECT
    `l`.`id` AS `id`,
    `l`.`user_id` AS `user_id`,
    `l`.`visibility` AS `visibility`,
    `l`.`source` AS `source`,
    `l`.`source_photo_id` AS `source_photo_id`,
    `l`.`queued_photo_id` AS `queued_photo_id`,
    `l`.`observed_at` AS `observed_at`,
    `l`.`observed_date` AS `observed_date`,
    `l`.`airport_id` AS `airport_id`,
    `l`.`airline_id` AS `airline_id`,
    `l`.`ac_reg` AS `ac_reg`,
    `l`.`ac_msn` AS `ac_msn`,
    `l`.`ac_type` AS `ac_type`,
    `l`.`pic_type` AS `pic_type`,
    `l`.`location_text` AS `location_text`,
    `l`.`note` AS `note`,
    `l`.`exif` AS `exif`,
    `l`.`pending_info` AS `pending_info`,
    `l`.`metadata` AS `metadata`,
    `l`.`image_raw_key` AS `image_raw_key`,
    `l`.`image_key` AS `image_key`,
    `l`.`image_status` AS `image_status`,
    `l`.`image_width` AS `image_width`,
    `l`.`image_height` AS `image_height`,
    `l`.`image_size` AS `image_size`,
    `l`.`created_at` AS `created_at`,
    `l`.`updated_at` AS `updated_at`,
    `l`.`deleted_at` AS `deleted_at`,
    `qp`.`status` AS `queued_photo_status`,
    `a`.`airport_cn` AS `airport_cn`,
    `a`.`airport_en` AS `airport_en`,
    `a`.`icao_code` AS `airport_icao_code`,
    `a`.`iata_code` AS `airport_iata_code`,
    `al`.`airline_cn` AS `airline_cn`,
    `al`.`airline_en` AS `airline_en`,
    `al`.`icao_code` AS `airline_icao_code`,
    `al`.`iata_code` AS `airline_iata_code`
FROM `observation_log` `l`
LEFT JOIN `photo` `qp` ON `qp`.`id` = `l`.`queued_photo_id`
LEFT JOIN `airport` `a` ON `a`.`id` = `l`.`airport_id`
LEFT JOIN `airline` `al` ON `al`.`id` = `l`.`airline_id`
WHERE `l`.`deleted_at` IS NULL;
