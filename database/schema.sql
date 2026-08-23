-- TeacherTool content database schema (Azure SQL)
-- See docs/azure-architecture-migration.md for the migration plan this supports.

-- ===== Lookup tables (replace hardcoded dictionaries in routes/api.js) =====

CREATE TABLE level_lookup (
    code        NVARCHAR(10)  NOT NULL PRIMARY KEY, -- 初级 / 中级 / 高级
    label_en    NVARCHAR(50)  NOT NULL               -- Beginner / Intermediate / Advanced
);

CREATE TABLE type_lookup (
    code        NVARCHAR(10)  NOT NULL PRIMARY KEY, -- 单选题 / 填空题 / 情境题
    label_en    NVARCHAR(50)  NOT NULL               -- Multiple Choice / Fill in the Blank / Scenario
);

-- ===== Question banks =====

CREATE TABLE question_banks (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    slug        NVARCHAR(100) NOT NULL UNIQUE,       -- e.g. "chenlaoshi-seasons-weather"
    name        NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NULL,
    theme       NVARCHAR(100) NULL,
    level       NVARCHAR(50)  NULL,
    curriculum  NVARCHAR(100) NULL,
    created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE questions (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    bank_id     INT           NOT NULL FOREIGN KEY REFERENCES question_banks(id),
    external_id NVARCHAR(20)  NOT NULL UNIQUE,       -- original id, e.g. "AN001"
    theme_zh    NVARCHAR(50)  NULL,                  -- original Chinese theme, kept for provenance
    level_code  NVARCHAR(10)  NULL FOREIGN KEY REFERENCES level_lookup(code),
    type_code   NVARCHAR(10)  NULL FOREIGN KEY REFERENCES type_lookup(code),
    prompt      NVARCHAR(MAX) NOT NULL,
    answer      NVARCHAR(MAX) NOT NULL,
    note        NVARCHAR(MAX) NULL,
    options     NVARCHAR(MAX) NULL,                  -- JSON array of option strings
    tags        NVARCHAR(MAX) NULL,                  -- JSON array of tag strings
    sort_order  INT           NOT NULL DEFAULT 0,
    CONSTRAINT CK_questions_options_json CHECK (options IS NULL OR ISJSON(options) = 1),
    CONSTRAINT CK_questions_tags_json CHECK (tags IS NULL OR ISJSON(tags) = 1)
);

CREATE INDEX IX_questions_bank_id ON questions(bank_id);

-- ===== Word lists =====

CREATE TABLE users (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    azure_principal_id  NVARCHAR(200) NOT NULL UNIQUE, -- from x-ms-client-principal-id
    email               NVARCHAR(320) NULL,
    display_name        NVARCHAR(200) NULL,
    created_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE word_lists (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    slug         NVARCHAR(100) NOT NULL UNIQUE,
    name         NVARCHAR(200) NOT NULL,
    description  NVARCHAR(MAX) NULL,
    theme        NVARCHAR(100) NULL,
    level        NVARCHAR(50)  NULL,
    curriculum   NVARCHAR(100) NULL,
    owner_user_id INT          NULL FOREIGN KEY REFERENCES users(id), -- NULL = public preset list
    created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_word_lists_owner_user_id ON word_lists(owner_user_id);

CREATE TABLE word_list_items (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    list_id       INT           NOT NULL FOREIGN KEY REFERENCES word_lists(id) ON DELETE CASCADE,
    zh            NVARCHAR(100) NOT NULL,
    py            NVARCHAR(200) NOT NULL,
    en            NVARCHAR(200) NOT NULL,
    img_blob_url  NVARCHAR(500) NULL,   -- Azure Blob Storage URL, empty until images are added
    note          NVARCHAR(MAX) NULL,
    sort_order    INT           NOT NULL DEFAULT 0
);

CREATE INDEX IX_word_list_items_list_id ON word_list_items(list_id);

-- ===== Site content (tool guides + articles), consumed by routes/index.js =====

CREATE TABLE tool_guides (
    slug           NVARCHAR(100) NOT NULL PRIMARY KEY,
    title          NVARCHAR(200) NOT NULL,
    eyebrow        NVARCHAR(200) NULL,
    grades         NVARCHAR(100) NULL,
    duration       NVARCHAR(100) NULL,
    summary        NVARCHAR(MAX) NULL,
    what_it_is     NVARCHAR(MAX) NULL,
    example_title  NVARCHAR(200) NULL,
    example        NVARCHAR(MAX) NULL,
    app_url        NVARCHAR(300) NULL,
    steps          NVARCHAR(MAX) NULL, -- JSON array of strings
    tips           NVARCHAR(MAX) NULL, -- JSON array of strings
    CONSTRAINT CK_tool_guides_steps_json CHECK (steps IS NULL OR ISJSON(steps) = 1),
    CONSTRAINT CK_tool_guides_tips_json CHECK (tips IS NULL OR ISJSON(tips) = 1)
);

CREATE TABLE articles (
    slug                NVARCHAR(150) NOT NULL PRIMARY KEY,
    category            NVARCHAR(100) NOT NULL,
    title               NVARCHAR(200) NOT NULL,
    description         NVARCHAR(MAX) NULL,
    read_time           NVARCHAR(50)  NULL,
    intro               NVARCHAR(MAX) NULL, -- JSON array of paragraph strings
    sections            NVARCHAR(MAX) NULL, -- JSON array of {heading, paragraphs, list, callout}
    related_tool_label  NVARCHAR(200) NULL,
    related_tool_href   NVARCHAR(300) NULL,
    created_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_articles_intro_json CHECK (intro IS NULL OR ISJSON(intro) = 1),
    CONSTRAINT CK_articles_sections_json CHECK (sections IS NULL OR ISJSON(sections) = 1)
);

-- ===== Seed the lookup tables =====

INSERT INTO level_lookup (code, label_en) VALUES
    (N'初级', N'Beginner'),
    (N'中级', N'Intermediate'),
    (N'高级', N'Advanced');

INSERT INTO type_lookup (code, label_en) VALUES
    (N'单选题', N'Multiple Choice'),
    (N'填空题', N'Fill in the Blank'),
    (N'情境题', N'Scenario');
