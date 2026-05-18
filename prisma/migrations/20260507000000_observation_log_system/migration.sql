-- CreateTable
CREATE TABLE `observation_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `visibility` VARCHAR(16) NOT NULL DEFAULT 'PRIVATE',
    `source` VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    `source_photo_id` INTEGER NULL,
    `queued_photo_id` INTEGER NULL,
    `observed_at` DATETIME(0) NOT NULL,
    `observed_date` DATE NULL,
    `airport_id` INTEGER NULL,
    `airline_id` INTEGER NULL,
    `ac_reg` VARCHAR(125) NULL,
    `ac_msn` VARCHAR(100) NULL,
    `ac_type` VARCHAR(255) NULL,
    `pic_type` VARCHAR(255) NULL,
    `location_text` VARCHAR(255) NULL,
    `note` TEXT NULL,
    `exif` JSON NULL,
    `pending_info` JSON NULL,
    `metadata` JSON NULL,
    `image_raw_key` VARCHAR(255) NULL,
    `image_key` VARCHAR(255) NULL,
    `image_status` VARCHAR(16) NOT NULL DEFAULT 'NONE',
    `image_width` INTEGER NULL,
    `image_height` INTEGER NULL,
    `image_size` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    UNIQUE INDEX `uniq_observation_log_source_photo`(`source_photo_id`),
    UNIQUE INDEX `uniq_observation_log_queued_photo`(`queued_photo_id`),
    INDEX `idx_observation_log_user_observed`(`user_id`, `observed_at`),
    INDEX `idx_observation_log_user_source`(`user_id`, `source`),
    INDEX `idx_observation_log_user_reg`(`user_id`, `ac_reg`),
    INDEX `idx_observation_log_user_airport`(`user_id`, `airport_id`),
    INDEX `idx_observation_log_user_airline`(`user_id`, `airline_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `observation_log_field` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `field_key` VARCHAR(64) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `value_type` VARCHAR(16) NOT NULL,
    `options` JSON NULL,
    `unit` VARCHAR(32) NULL,
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uniq_observation_log_field_user_key`(`user_id`, `field_key`),
    INDEX `idx_observation_log_field_user_archived`(`user_id`, `is_archived`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `observation_log_field_value` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `log_id` INTEGER NOT NULL,
    `field_id` INTEGER NOT NULL,
    `text_value` TEXT NULL,
    `number_value` DOUBLE NULL,
    `date_value` DATETIME(0) NULL,
    `bool_value` BOOLEAN NULL,
    `select_value` VARCHAR(120) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uniq_observation_log_field_value`(`log_id`, `field_id`),
    INDEX `idx_observation_log_field_select`(`field_id`, `select_value`),
    INDEX `idx_observation_log_field_number`(`field_id`, `number_value`),
    INDEX `idx_observation_log_field_date`(`field_id`, `date_value`),
    INDEX `idx_observation_log_field_bool`(`field_id`, `bool_value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `observation_log_tag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uniq_observation_log_tag_user_name`(`user_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `observation_log_tag_link` (
    `log_id` INTEGER NOT NULL,
    `tag_id` INTEGER NOT NULL,

    INDEX `idx_observation_log_tag_link_tag`(`tag_id`),
    PRIMARY KEY (`log_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aircraft_info_submission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `create_user` INTEGER NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'WAITING',
    `reg` VARCHAR(63) NOT NULL,
    `msn` VARCHAR(20) NULL,
    `ln` VARCHAR(20) NULL,
    `airline_id` INTEGER NULL,
    `air_type` VARCHAR(25) NULL,
    `remark` VARCHAR(256) NULL,
    `review_message` VARCHAR(256) NULL,
    `reviewer_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    `reviewed_at` DATETIME(0) NULL,
    `is_delete` BOOLEAN NOT NULL DEFAULT false,

    INDEX `idx_aircraft_info_submission_status`(`status`, `created_at`),
    INDEX `idx_aircraft_info_submission_user_status`(`create_user`, `status`),
    INDEX `idx_aircraft_info_submission_reg`(`reg`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
