-- CreateTable
CREATE TABLE `airline` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `airline_cn` VARCHAR(255) NULL,
    `airline_en` VARCHAR(255) NULL,
    `icao_code` VARCHAR(255) NULL,
    `iata_code` VARCHAR(255) NULL,
    `remark` VARCHAR(255) NULL,
    `status` VARCHAR(255) NULL,
    `create_user` INTEGER NULL,
    `create_time` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `is_delete` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `airport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `airport_cn` VARCHAR(255) NULL,
    `airport_en` VARCHAR(255) NULL,
    `icao_code` VARCHAR(127) NULL,
    `iata_code` VARCHAR(127) NULL,
    `status` VARCHAR(31) NULL DEFAULT 'AVAILABLE',
    `create_user` INTEGER NULL,
    `create_time` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `is_delete` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `airtype` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `manufacturer_cn` VARCHAR(255) NULL,
    `manufacturer_en` VARCHAR(255) NULL,
    `type` VARCHAR(255) NULL,
    `sub_type` VARCHAR(255) NULL,
    `icao_code` VARCHAR(255) NULL,
    `status` ENUM('REJECT', 'AVAILABLE', 'WAITING') NULL DEFAULT 'WAITING',
    `create_user` INTEGER NULL,
    `create_time` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `remark` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `photo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` VARCHAR(255) NULL DEFAULT 'WAIT SCREEN',
    `queue` VARCHAR(255) NULL,
    `upload_user_id` INTEGER NOT NULL,
    `storage_status` VARCHAR(255) NULL DEFAULT 'WAIT',
    `ac_type` VARCHAR(255) NULL,
    `ac_reg` VARCHAR(255) NULL,
    `ac_msn` VARCHAR(255) NULL,
    `airline_id` INTEGER NULL,
    `airport_id` INTEGER NULL,
    `pic_type` VARCHAR(255) NULL,
    `user_remark` VARCHAR(255) NULL,
    `message` VARCHAR(255) NULL,
    `photo_time` DATE NULL,
    `exif` JSON NULL,
    `watermark` JSON NULL,
    `upload_time` DATE NULL DEFAULT (now()),
    `screener_1` INTEGER NULL,
    `screener_2` INTEGER NULL,
    `need_screener_2` BOOLEAN NULL,
    `result` VARCHAR(255) NULL DEFAULT 'REJECT',
    `reason` VARCHAR(255) NULL,
    `screener_message` VARCHAR(255) NULL,
    `is_delete` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_email` VARCHAR(120) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(256) NOT NULL,
    `role` VARCHAR(127) NULL DEFAULT 'USER',
    `airport_id` INTEGER NULL,
    `cover_photo_id` INTEGER NULL,
    `allow_toga_use` BOOLEAN NULL DEFAULT true,
    `allow_third_use` BOOLEAN NULL DEFAULT true,
    `passing_rate` TINYINT NOT NULL DEFAULT 0,
    `total_queue` TINYINT NOT NULL DEFAULT 5,
    `free_queue` TINYINT NOT NULL DEFAULT 5,
    `priority_queue` TINYINT NOT NULL DEFAULT 0,
    `free_priority_queue` INTEGER NOT NULL DEFAULT 0,
    `total_photo` INTEGER NOT NULL DEFAULT 0,
    `create_time` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `update_time` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `status` VARCHAR(31) NULL DEFAULT 'NORMAL',
    `suspension_days` INTEGER NULL DEFAULT 0,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `id`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aircraft` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `msn` VARCHAR(20) NULL,
    `ln` VARCHAR(20) NULL,
    `reg` VARCHAR(20) NOT NULL,
    `airline_id` INTEGER NULL,
    `airline` VARCHAR(60) NULL,
    `air_type` VARCHAR(25) NULL,
    `delivery_date` DATE NULL,
    `remark` VARCHAR(256) NULL,
    `is_delete` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `id`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notam` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NULL,
    `content` TEXT NULL,
    `create_time` TIMESTAMP(0) NULL,
    `create_user` INTEGER NULL,
    `show` BOOLEAN NULL,
    `is_delete` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `direct_message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sender_user_id` INTEGER NOT NULL,
    `photo_id` INTEGER NULL,
    `contact_info` VARCHAR(255) NULL,
    `receiver_user_id` INTEGER NULL,
    `content` VARCHAR(255) NULL,
    `create_time` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `status` VARCHAR(255) NULL DEFAULT 'WAITING',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `photo_from_v1` (
    `id` INTEGER NULL,
    `uploader` INTEGER NULL,
    `in_upload_queue` BOOLEAN NULL,
    `aircraft_info` INTEGER NULL,
    `airport_info` INTEGER NULL,
    `pic_type` VARCHAR(255) NULL,
    `reg` VARCHAR(125) NULL,
    `msn` VARCHAR(100) NULL,
    `airtype` VARCHAR(125) NULL,
    `airline` VARCHAR(125) NULL,
    `remark` VARCHAR(256) NULL,
    `photo_url` TEXT NULL,
    `allow_socialmedia` BOOLEAN NULL,
    `upload_time` BIGINT NULL,
    `result` TINYINT NULL,
    `vote` INTEGER NULL,
    `photo_time` DATE NULL,
    `update_time` DATETIME(0) NULL,
    `is_delete` BOOLEAN NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `upload_queue` (
    `id` INTEGER NULL,
    `queue` VARCHAR(10) NULL,
    `user_id` INTEGER NULL,
    `photo_id` INTEGER NULL,
    `comment` VARCHAR(256) NULL,
    `screener_1` INTEGER NULL,
    `screener_2` INTEGER NULL,
    `need_screener_2` TINYINT NULL,
    `screening` BOOLEAN NULL,
    `screener` INTEGER NULL,
    `last_screen_time` BIGINT NULL,
    `reason` VARCHAR(512) NULL,
    `result` TINYINT NULL,
    `screener_message` VARCHAR(256) NULL,
    `upload_time` DATETIME(0) NULL,
    `is_delete` BOOLEAN NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_from_v1` (
    `id` INTEGER NULL,
    `user_email` VARCHAR(120) NULL,
    `username` VARCHAR(50) NULL,
    `password` VARCHAR(256) NULL,
    `role` TINYINT NULL,
    `passing_rate` TINYINT NULL,
    `total_queue` TINYINT NULL,
    `free_queue` TINYINT NULL,
    `priority_queue` TINYINT NULL,
    `free_priority_queue` INTEGER NULL,
    `total_photo` INTEGER NULL,
    `create_time` DATETIME(0) NULL,
    `update_time` DATETIME(0) NULL,
    `status` TINYINT NULL,
    `suspension_days` INTEGER NULL,
    `email_verify` BOOLEAN NULL,
    `email_verify_token` VARCHAR(150) NULL,
    `is_deleted` BOOLEAN NULL,
    `n_status` VARCHAR(255) NULL DEFAULT 'NORMAL',
    `n_role` VARCHAR(255) NULL DEFAULT 'USER',
    `allow_toga_use` BOOLEAN NULL DEFAULT true,
    `allow_third_use` BOOLEAN NULL DEFAULT false,
    `airport_id` INTEGER NULL,
    `cover_photo_id` INTEGER NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
