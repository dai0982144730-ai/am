-- CreateEnum
CREATE TYPE "ContentGroup" AS ENUM ('ai', 'triet_hoc', 'truyen', 'music', 'new_search', 'other');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('youtube_channel', 'blog_feed', 'forum_community', 'podcast_rss', 'soundcloud_channel');

-- CreateEnum
CREATE TYPE "SourceReputationTier" AS ENUM ('official_vendor', 'expert_individual', 'community_forum', 'aggregator');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('subscribed', 'not_subscribed', 'unknown');

-- CreateEnum
CREATE TYPE "ContentItemType" AS ENUM ('video', 'podcast_episode', 'audio_track', 'blog_article', 'forum_post');

-- CreateEnum
CREATE TYPE "NarrationType" AS ENUM ('human_voice', 'ai_tts', 'text_only', 'instrumental', 'unknown');

-- CreateEnum
CREATE TYPE "IngestSource" AS ENUM ('subscribed', 'discovery', 'manual', 'adhoc_interest');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('pending_transcript', 'pending_classification', 'classified', 'transcript_unavailable', 'rejected');

-- CreateEnum
CREATE TYPE "TranscriptSource" AS ENUM ('captions', 'unofficial_scrape', 'podcast_shownotes', 'asr_fallback', 'blog_article_text');

-- CreateEnum
CREATE TYPE "FetchStatus" AS ENUM ('success', 'failed', 'not_applicable');

-- CreateEnum
CREATE TYPE "AuthorDomain" AS ENUM ('story_writer', 'philosophy_teacher', 'ai_blog_source', 'music_curator');

-- CreateEnum
CREATE TYPE "AuthorOrigin" AS ENUM ('whitelist_seed', 'llm_discovered');

-- CreateEnum
CREATE TYPE "AiSubtopic" AS ENUM ('claude_news', 'ai_news_general', 'ai_agent_enterprise', 'coding_experience_howto', 'claude_usage_guide');

-- CreateEnum
CREATE TYPE "PhilosophySchool" AS ENUM ('stoic', 'hien_sinh', 'tam_ly_hoc_hien_dai', 'phat_giao_nguyen_thuy', 'khac');

-- CreateEnum
CREATE TYPE "PhilosophyContentForm" AS ENUM ('giang_phap', 'van_dap', 'ung_dung_thuc_hanh', 'phan_tich_hoc_thuat');

-- CreateEnum
CREATE TYPE "ListenerLevel" AS ENUM ('moi_bat_dau', 'chuyen_sau');

-- CreateEnum
CREATE TYPE "StoryGenre" AS ENUM ('kinh_di', 'vien_tuong', 'phieu_luu_mao_hiem');

-- CreateEnum
CREATE TYPE "StoryOrigin" AS ENUM ('viet_nam_sang_tac', 'dich_trung_quoc', 'dich_au_my', 'khac');

-- CreateEnum
CREATE TYPE "StoryIntensity" AS ENUM ('nhe_nhang', 'cang_thang', 'kinh_khung');

-- CreateEnum
CREATE TYPE "MusicGenre" AS ENUM ('workout_bpm', 'dance', 'piano', 'guitar_rock', 'nhac_vang');

-- CreateEnum
CREATE TYPE "BpmConfidence" AS ENUM ('stated_in_title', 'stated_in_description', 'inferred');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('desktop', 'mobile');

-- CreateEnum
CREATE TYPE "ConsumptionEventType" AS ENUM ('play', 'pause', 'seek', 'complete', 'abandon');

-- CreateEnum
CREATE TYPE "NoteInputType" AS ENUM ('text', 'voice');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('freeform', 'action_item', 'quote');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('todo', 'done');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('new_save', 'misplaced_fix');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('pending', 'approved', 'rejected', 'applied');

-- CreateEnum
CREATE TYPE "PlaylistActionType" AS ENUM ('create_playlist', 'move_item', 'add_item');

-- CreateEnum
CREATE TYPE "DigestTrigger" AS ENUM ('scheduled_daily', 'manual');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('running', 'success', 'failed');

-- CreateEnum
CREATE TYPE "DigestDensity" AS ENUM ('it', 'vua', 'nhieu');

-- CreateEnum
CREATE TYPE "ExternalPlatform" AS ENUM ('hackernews', 'reddit');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "followerCount" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'unknown',
    "reputationTier" "SourceReputationTier",
    "contentGroupHint" "ContentGroup",
    "uploadsPlaylistId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCrawledAt" TIMESTAMP(3),
    "crawlPriority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT,
    "type" "ContentItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "viewOrPlayCount" INTEGER,
    "likeCount" INTEGER,
    "commentCount" INTEGER,
    "originalLanguage" TEXT,
    "contentGroup" "ContentGroup" NOT NULL,
    "subtopic" TEXT,
    "narrationType" "NarrationType" NOT NULL DEFAULT 'unknown',
    "ingestSource" "IngestSource" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'pending_transcript',
    "adHocInterestId" TEXT,
    "dedupGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "source" "TranscriptSource" NOT NULL,
    "language" TEXT,
    "rawText" TEXT NOT NULL,
    "segments" JSONB,
    "fetchStatus" "FetchStatus" NOT NULL DEFAULT 'success',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrationAsset" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "scriptText" TEXT NOT NULL,
    "detailLevel" TEXT NOT NULL DEFAULT 'full_retelling',
    "ttsAudioUrl" TEXT,
    "ttsVoice" TEXT,
    "durationSeconds" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NarrationAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "domain" "AuthorDomain" NOT NULL,
    "origin" "AuthorOrigin" NOT NULL,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verificationEvidence" JSONB,
    "approvedByUser" BOOLEAN NOT NULL DEFAULT false,
    "pendingReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorOnSource" (
    "authorId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorOnSource_pkey" PRIMARY KEY ("authorId","sourceId")
);

-- CreateTable
CREATE TABLE "ContentClassification" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "extractedTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "extractedAuthorNameRaw" TEXT,
    "authorCreditedInDescription" BOOLEAN NOT NULL DEFAULT false,
    "contentQualityNotes" TEXT,
    "authorId" TEXT,
    "aiSubtopic" "AiSubtopic",
    "philosophySchool" "PhilosophySchool",
    "philosophyContentForm" "PhilosophyContentForm",
    "listenerLevel" "ListenerLevel",
    "misleadingContentFlag" BOOLEAN NOT NULL DEFAULT false,
    "storyGenre" "StoryGenre",
    "storyOrigin" "StoryOrigin",
    "storyIntensity" "StoryIntensity",
    "basedOnTrueStory" BOOLEAN,
    "aiGeneratedSuspicionScore" DOUBLE PRECISION,
    "musicGenre" "MusicGenre",
    "bpm" INTEGER,
    "bpmBucket" TEXT,
    "bpmConfidence" "BpmConfidence",
    "mixLengthBucket" TEXT,
    "isContinuousMix" BOOLEAN,
    "modelUsed" TEXT,
    "promptVersion" TEXT,
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentScore" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "popularityScore" DOUBLE PRECISION,
    "engagementDepthScore" DOUBLE PRECISION,
    "discussionQualityScore" DOUBLE PRECISION,
    "sourceAuthorityScore" DOUBLE PRECISION,
    "contentQualityScore" DOUBLE PRECISION,
    "compositeScore" DOUBLE PRECISION,
    "scoreVersion" TEXT NOT NULL DEFAULT 'v1',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceQualityProfile" (
    "id" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "weightPopularity" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "weightEngagementDepth" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "weightDiscussion" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "weightAuthority" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "weightContentQuality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceQualityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentAnalysis" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "sampledCount" INTEGER NOT NULL,
    "discussionQualityScore" DOUBLE PRECISION NOT NULL,
    "signals" JSONB,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalDiscussion" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "platform" "ExternalPlatform" NOT NULL,
    "score" INTEGER,
    "commentCount" INTEGER,
    "url" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalDiscussion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DedupGroup" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT,
    "topicSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DedupGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdHocInterest" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "autoScan" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScannedAt" TIMESTAMP(3),
    "resultCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdHocInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTasteProfile" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "preferredSubtopics" JSONB,
    "preferredDurationMin" INTEGER,
    "preferredDurationMax" INTEGER,
    "preferredNarrationType" "NarrationType",
    "preferredLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moodSchedule" JSONB,
    "blockedVoices" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedSourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedAuthorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dislikedPatterns" JSONB,
    "freeformSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTasteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumptionEvent" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "sessionId" TEXT,
    "eventType" "ConsumptionEventType" NOT NULL,
    "positionSeconds" INTEGER NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumptionSession" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
    "percentComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "replayCount" INTEGER NOT NULL DEFAULT 0,
    "explicitRating" INTEGER,
    "emotionTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceType" "DeviceType" NOT NULL,

    CONSTRAINT "ConsumptionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumePoint" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "positionSeconds" INTEGER NOT NULL,
    "lastDevice" "DeviceType" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "timestampSeconds" INTEGER,
    "inputType" "NoteInputType" NOT NULL DEFAULT 'text',
    "rawText" TEXT NOT NULL,
    "voiceAudioUrl" TEXT,
    "autoTags" JSONB,
    "userCorrectedTags" JSONB,
    "noteType" "NoteType" NOT NULL DEFAULT 'freeform',
    "collectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeCollection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "autoCreated" BOOLEAN NOT NULL DEFAULT true,
    "synthesizedSummary" TEXT,
    "lastSynthesizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'todo',
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryItem" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "folder" TEXT,
    "readStatus" TEXT NOT NULL DEFAULT 'unread',
    "personalNote" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubePlaylist" (
    "id" TEXT NOT NULL,
    "youtubePlaylistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "managedByAI" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YouTubePlaylist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistOrganizationSuggestion" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "suggestedPlaylistId" TEXT,
    "newPlaylistTitle" TEXT,
    "currentPlaylistTitle" TEXT,
    "reason" TEXT NOT NULL,
    "type" "SuggestionType" NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "PlaylistOrganizationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistActionLog" (
    "id" TEXT NOT NULL,
    "actionType" "PlaylistActionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigestRun" (
    "id" TEXT NOT NULL,
    "triggeredBy" "DigestTrigger" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "newItemsFound" INTEGER NOT NULL DEFAULT 0,
    "status" "RunStatus" NOT NULL DEFAULT 'running',
    "errorSummary" TEXT,

    CONSTRAINT "DigestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantBriefing" (
    "id" TEXT NOT NULL,
    "digestRunId" TEXT NOT NULL,
    "pickedItemsTiered" JSONB NOT NULL,
    "conversationalScript" TEXT NOT NULL,
    "audioBriefingUrl" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userRespondedAt" TIMESTAMP(3),

    CONSTRAINT "AssistantBriefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAssistantSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "dailyScanHour" INTEGER NOT NULL DEFAULT 21,
    "digestDensity" "DigestDensity" NOT NULL DEFAULT 'vua',
    "autoScanEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ttsVoice" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAssistantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilterPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentGroup" "ContentGroup",
    "filterJson" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilterPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaUsageLog" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "endpoint" TEXT NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "QuotaUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "status" "RunStatus" NOT NULL DEFAULT 'running',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentEmbedding" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteEmbedding" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Source_type_lastCrawledAt_idx" ON "Source"("type", "lastCrawledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Source_type_externalId_key" ON "Source"("type", "externalId");

-- CreateIndex
CREATE INDEX "ContentItem_contentGroup_publishedAt_idx" ON "ContentItem"("contentGroup", "publishedAt");

-- CreateIndex
CREATE INDEX "ContentItem_sourceId_publishedAt_idx" ON "ContentItem"("sourceId", "publishedAt");

-- CreateIndex
CREATE INDEX "ContentItem_status_idx" ON "ContentItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_sourceId_externalId_key" ON "ContentItem"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_contentItemId_key" ON "Transcript"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "NarrationAsset_contentItemId_key" ON "NarrationAsset"("contentItemId");

-- CreateIndex
CREATE INDEX "Author_domain_pendingReview_idx" ON "Author"("domain", "pendingReview");

-- CreateIndex
CREATE UNIQUE INDEX "Author_canonicalName_domain_key" ON "Author"("canonicalName", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "ContentClassification_contentItemId_key" ON "ContentClassification"("contentItemId");

-- CreateIndex
CREATE INDEX "ContentClassification_authorId_idx" ON "ContentClassification"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentScore_contentItemId_key" ON "ContentScore"("contentItemId");

-- CreateIndex
CREATE INDEX "ContentScore_compositeScore_idx" ON "ContentScore"("compositeScore");

-- CreateIndex
CREATE UNIQUE INDEX "SourceQualityProfile_sourceType_key" ON "SourceQualityProfile"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "CommentAnalysis_contentItemId_key" ON "CommentAnalysis"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalDiscussion_contentItemId_platform_url_key" ON "ExternalDiscussion"("contentItemId", "platform", "url");

-- CreateIndex
CREATE UNIQUE INDEX "DedupGroup_representativeId_key" ON "DedupGroup"("representativeId");

-- CreateIndex
CREATE UNIQUE INDEX "AdHocInterest_keyword_key" ON "AdHocInterest"("keyword");

-- CreateIndex
CREATE INDEX "AdHocInterest_active_autoScan_idx" ON "AdHocInterest"("active", "autoScan");

-- CreateIndex
CREATE UNIQUE INDEX "UserTasteProfile_version_key" ON "UserTasteProfile"("version");

-- CreateIndex
CREATE INDEX "ConsumptionEvent_contentItemId_timestamp_idx" ON "ConsumptionEvent"("contentItemId", "timestamp");

-- CreateIndex
CREATE INDEX "ConsumptionSession_contentItemId_startedAt_idx" ON "ConsumptionSession"("contentItemId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResumePoint_contentItemId_key" ON "ResumePoint"("contentItemId");

-- CreateIndex
CREATE INDEX "Note_contentItemId_timestampSeconds_idx" ON "Note"("contentItemId", "timestampSeconds");

-- CreateIndex
CREATE INDEX "Note_collectionId_idx" ON "Note"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeCollection_title_key" ON "KnowledgeCollection"("title");

-- CreateIndex
CREATE UNIQUE INDEX "ActionItem_noteId_key" ON "ActionItem"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_contentItemId_key" ON "LibraryItem"("contentItemId");

-- CreateIndex
CREATE INDEX "LibraryItem_folder_idx" ON "LibraryItem"("folder");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubePlaylist_youtubePlaylistId_key" ON "YouTubePlaylist"("youtubePlaylistId");

-- CreateIndex
CREATE INDEX "PlaylistOrganizationSuggestion_status_createdAt_idx" ON "PlaylistOrganizationSuggestion"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantBriefing_digestRunId_key" ON "AssistantBriefing"("digestRunId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "QuotaUsageLog_date_idx" ON "QuotaUsageLog"("date");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaUsageLog_date_endpoint_key" ON "QuotaUsageLog"("date", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "JobRun_idempotencyKey_key" ON "JobRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "JobRun_jobType_startedAt_idx" ON "JobRun"("jobType", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentEmbedding_contentItemId_key" ON "ContentEmbedding"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteEmbedding_noteId_key" ON "NoteEmbedding"("noteId");

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_adHocInterestId_fkey" FOREIGN KEY ("adHocInterestId") REFERENCES "AdHocInterest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_dedupGroupId_fkey" FOREIGN KEY ("dedupGroupId") REFERENCES "DedupGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrationAsset" ADD CONSTRAINT "NarrationAsset_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorOnSource" ADD CONSTRAINT "AuthorOnSource_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorOnSource" ADD CONSTRAINT "AuthorOnSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentClassification" ADD CONSTRAINT "ContentClassification_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentClassification" ADD CONSTRAINT "ContentClassification_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentScore" ADD CONSTRAINT "ContentScore_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentAnalysis" ADD CONSTRAINT "CommentAnalysis_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalDiscussion" ADD CONSTRAINT "ExternalDiscussion_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DedupGroup" ADD CONSTRAINT "DedupGroup_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionEvent" ADD CONSTRAINT "ConsumptionEvent_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionEvent" ADD CONSTRAINT "ConsumptionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConsumptionSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionSession" ADD CONSTRAINT "ConsumptionSession_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumePoint" ADD CONSTRAINT "ResumePoint_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "KnowledgeCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistOrganizationSuggestion" ADD CONSTRAINT "PlaylistOrganizationSuggestion_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistOrganizationSuggestion" ADD CONSTRAINT "PlaylistOrganizationSuggestion_suggestedPlaylistId_fkey" FOREIGN KEY ("suggestedPlaylistId") REFERENCES "YouTubePlaylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantBriefing" ADD CONSTRAINT "AssistantBriefing_digestRunId_fkey" FOREIGN KEY ("digestRunId") REFERENCES "DigestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEmbedding" ADD CONSTRAINT "ContentEmbedding_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteEmbedding" ADD CONSTRAINT "NoteEmbedding_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
