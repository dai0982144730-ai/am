# Am — Web cá nhân hoá tuyển chọn & gợi ý nội dung bằng Claude

*(YouTube + Blog/Diễn đàn AI + Podcast + SoundCloud — single-user)*

## Context

Người dùng theo dõi **5 chuyên mục**:

1. **AI** — tin AI nói chung + tin Claude nói riêng, ứng dụng AI/hệ thống AI agent cho công việc & doanh nghiệp, kinh nghiệm/hướng dẫn viết code bằng AI, hướng dẫn dùng Claude.
2. **Triết học** — tâm lý học (Stoic, hiện sinh, tâm lý học hiện đại) **và Phật giáo Nguyên thuỷ/Theravada**. Thiên về giảng pháp/vấn đáp/ứng dụng thực hành đời sống/phân tích học thuật.
3. **Truyện** — kinh dị, viễn tưởng, phiêu lưu mạo hiểm; bắt buộc từ tác giả có tên tuổi, **không** phải truyện AI viết hàng loạt đang tràn lan.
4. **Music** — nhạc tập thể thao theo BPM (dải 140–180), dance, piano, guitar rock, nhạc vàng.
5. **New** — chuyên mục mở: người dùng tự gõ nội dung muốn tìm, thay đổi theo từng ngày. Đây là "kênh linh hoạt" cho những mối quan tâm nhất thời không thuộc 4 nhóm cố định trên.

Vấn đề cốt lõi:
- **Chất lượng mới là bài toán khó nhất, không phải chủ đề.** Lọc theo chủ đề/thời lượng/ngôn ngữ chỉ là việc dễ. Cái quyết định app này có dùng được hay không là: giữa hàng chục kết quả cùng chủ đề, cái nào thực sự hay? Và vì hệ thống quét **nhiều loại nguồn khác nhau**, mỗi loại lại có bộ chỉ số hoàn toàn khác nhau — YouTube có view/like/subscriber, diễn đàn có upvote, còn blog và podcast **gần như không có chỉ số công khai nào**. Không thể dùng một công thức chung cho tất cả.
- Nội dung tràn lan, đặc biệt truyện do AI sản xuất hàng loạt chất lượng thấp — lọc thủ công tốn thời gian và hay trật.
- YouTube tiếng Việt cập nhật tin AI **chậm hơn nhiều** so với blog/diễn đàn phương Tây → cần đọc thẳng nguồn chữ viết uy tín và thuật lại bằng audio tiếng Việt.
- Mỗi ngày quét ra quá nhiều nội dung không thể xem hết → cần một trợ lý **chủ động chắt lọc và trò chuyện**, không phải một danh sách dài vô tận.

Mục tiêu: web cá nhân (single-user, dùng cả điện thoại lẫn máy tính) có Claude đứng sau để tự quét → đọc hiểu → chấm điểm → lọc theo bộ trường chi tiết từng chủ đề → cá nhân hoá theo thói quen → trò chuyện/gợi ý → và ghi nhớ kiến thức đã tiếp nhận.

### Quyết định phạm vi đã chốt

- Repo Next.js **hoàn toàn mới**, tách khỏi `qlda-web`, push GitHub riêng.
- YouTube Data API v3 (chính thức) + transcript qua thư viện không chính thức (không có cách chính thức đọc transcript video người khác).
- Xác thực "tác giả/nguồn uy tín": whitelist người dùng nhập + LLM tự mở rộng, **luôn qua hàng đợi duyệt thủ công** (`pending_review`).
- **Chấm chất lượng theo từng loại nguồn**, trọng số cấu hình riêng cho mỗi loại trong mục Cài đặt — **chỉ dùng trọng số xếp hạng, không đặt ngưỡng loại bỏ cứng** (kênh nhỏ nhưng hay vẫn có cơ hội xuất hiện).
- **Chất lượng bình luận**: LLM đọc top bình luận, nhưng chỉ với nhóm ứng viên đã lọt vòng lọc đầu mỗi ngày (tiết kiệm quota + chi phí).
- Thiết kế đầy đủ toàn bộ tính năng ngay từ đầu, chia phase triển khai; **nhánh Blog/Diễn đàn AI + TTS tiếng Việt ưu tiên sớm** (bù độ trễ tin tức).
- Nguồn: YouTube (lõi) → Blog/Diễn đàn AI (ưu tiên cao) → Podcast RSS → SoundCloud.
- Giao diện **bám sát YouTube** cho quen tay, làm cả desktop lẫn mobile.
- **Không** làm trigger warning tuỳ chỉnh.

---

## Kiến trúc tổng thể

```
Ingestion/Crawler (adapter: YouTube / Blog+Forum / Podcast / SoundCloud)
        │
        ├──► [nhánh nội dung nói] Transcript Fetcher (cache + throttle)
        │            │
        │            ▼
        │     Classification Pipeline (Claude đọc transcript/bài viết → JSON có cấu trúc)
        │
        └──► [nhánh Music] Metadata Extractor (title/description/tags → BPM, genre — KHÔNG transcript, KHÔNG LLM đọc sâu)
                     │
                     ▼
        Quality/Authority Scoring Engine (engagement + chất lượng nội dung + uy tín tác giả)
                     │
        ├──► Search/Filter API (query có cấu trúc, không gọi LLM trên critical path)
        ├──► Personalization/Ranking Engine (taste profile + embeddings)
        ├──► Digest/Dedup job (gộp trùng lặp + sinh bản tin chủ động)
        └──► Narration job (thuật lại bài viết → TTS tiếng Việt)
                     │
                     ▼
        Chat Agent (Claude tool-use) ──► Player/Consumption Tracking UI
```

**Ba nguyên tắc thiết kế xuyên suốt:**

1. **Tổng quát hoá nguồn từ Phase 0**: mọi thứ xoay quanh `Source`/`ContentItem`, không cứng theo "YouTube video" — thêm nguồn mới chỉ là thêm 1 adapter.
2. **Music đi đường riêng trong pipeline**: nhạc không có transcript hữu ích, đánh giá "hay" của nhạc cũng không dựa trên nội dung ngữ nghĩa. Ép nhạc qua pipeline transcript+LLM sẽ vừa tốn tiền vừa cho kết quả vô nghĩa → tách nhánh ngay từ bước sau ingestion.
3. **Mọi thao tác ghi ra thế giới thật đều qua "đề xuất → duyệt → áp dụng"**: ghi playlist YouTube thật, công nhận tác giả mới vào whitelist — không bao giờ tự động.

---

## Data model (khái niệm)

### Lõi nội dung

- **Source**: `type` (`youtube_channel | blog_feed | forum_community | podcast_rss | soundcloud_channel`), `externalId/url`, `title`, `followerCount`, `isVerified`, `subscriptionStatus` (`subscribed | not_subscribed`), `contentGroupHint`, `sourceReputationTier` (`official_vendor | expert_individual | community_forum | aggregator` — dùng cho nhánh AI), `lastCrawledAt`, `crawlPriority`
- **ContentItem**: `sourceId`, `type` (`video | podcast_episode | audio_track | blog_article | forum_post`), `title`, `description`, `publishedAt`, `durationSeconds`, `viewOrPlayCount`, `likeCount`, `commentCount`, `originalLanguage`, `contentGroup` (`ai | triet_hoc | truyen | music | new_search | other`), `subtopic`, `narrationType` (`human_voice | ai_tts | text_only | instrumental`), `ingestSource` (`subscribed | discovery | manual | adhoc_interest`), `adHocInterestId` (FK, chỉ với `new_search`), `status`
- **Transcript**: `contentItemId` (1-1), `source` (`captions | unofficial_scrape | podcast_shownotes | asr_fallback | blog_article_text`), `language`, `rawText`, `segments` (JSON), `fetchStatus` — *không áp dụng cho `contentGroup = music`*
- **NarrationAsset** (blog/diễn đàn → audio tiếng Việt): `contentItemId`, `scriptText` (thuật lại **đầy đủ gần bản gốc**, diễn đạt bằng lời văn riêng), `detailLevel` (`full_retelling`), `ttsAudioUrl`, `ttsVoice`, `generatedAt`
- **Author**: `canonicalName`, `aliases`, `domainType` (`story_writer | philosophy_teacher | ai_blog_source | music_curator`), `sourceType` (`whitelist_seed | llm_discovered`), `trustScore`, `verificationEvidence` (JSON), `approvedByUser`, `pendingReview`
- **ContentClassification**: `extractedTopics`, `extractedAuthorNameRaw`, `authorCreditedInDescription`, `narrationType`, `aiGeneratedSuspicionScore`, `contentQualityNotes`, `modelUsed`, `promptVersion` + các field đặc thù theo nhóm (bên dưới)
- **ContentScore**: 4 trụ tín hiệu chuẩn hoá 0–1 — `popularityScore`, `engagementDepthScore`, `discussionQualityScore`, `sourceAuthorityScore` — cộng `contentQualityScore` (LLM, không áp dụng cho Music), `compositeScore`, `scoreVersion`
- **SourceQualityProfile** (cấu hình trong Cài đặt): `sourceType` (`youtube | soundcloud | forum | blog | podcast`), `weights` (JSON — 4 trụ + LLM, tổng 100%), `updatedAt` — mỗi loại nguồn một bộ trọng số riêng, versioned để tái tính điểm cũ
- **CommentAnalysis** (vòng 2, chỉ cho ứng viên đứng đầu): `contentItemId`, `sampledCount`, `discussionQualityScore`, `signals` (JSON: `spam_emoji_only` · `clickbait_complaint` · `praised_specific_detail`), `analyzedAt`
- **ExternalDiscussion** (tín hiệu phái sinh cho blog/podcast không có chỉ số): `contentItemId`, `platform` (`hackernews | reddit`), `score`, `commentCount`, `url`, `fetchedAt`
- **AdHocInterest** (chuyên mục "New"): `keyword`, `note`, `active` (bool), `autoScan` (bool), `createdAt`, `lastScannedAt`, `resultCount` — mỗi từ khoá đang bật tốn 1 lần `search.list` = 100 units/ngày, nên UI hiển thị rõ chi phí quota và cảnh báo khi vượt ~10 từ khoá đang hoạt động
- **ContentEmbedding** / **NoteEmbedding**: `vector` (pgvector), `embeddingModel`, `sourceText`
- **DedupGroup**: `representativeItemId`, `memberItemIds`

### Cá nhân hoá & hành vi

- **UserTasteProfile** (versioned): `preferredSubtopics` (weight map), `preferredDurationRange`, `preferredNarrationType`, `preferredLanguages`, `moodSchedule`, `blockedVoices`, `blockedSourceIds`, `blockedAuthorIds`, `dislikedPatterns`, `freeformSummary`
- **ConsumptionEvent**: `play | pause | seek | complete | abandon`, `positionSeconds`, `timestamp`, `deviceType` (`desktop | mobile`)
- **ConsumptionSession**: `watchedSeconds`, `percentComplete`, `completed`, `replayCount`, `explicitRating` (1–5 sao), `emotionTags` (JSON: "sợ", "an yên", "hữu ích"…)
- **ResumePoint** (đồng bộ đa thiết bị): `contentItemId`, `positionSeconds`, `updatedAt`, `lastDevice` — vì người dùng dùng cả PC lẫn điện thoại, bỏ dở trên máy phải nghe tiếp được trên điện thoại

### Trợ lý ghi chú & trí nhớ

- **Note**: `contentItemId`, `timestampSeconds`, `inputType` (`text | voice`), `rawText`, `voiceAudioUrl`, `autoTags` (JSON, LLM tự gắn), `userCorrectedTags` (JSON, học từ lần sửa), `collectionId`, `noteType` (`freeform | action_item | quote`), `createdAt`
- **KnowledgeCollection**: `title`, `autoCreated`, `synthesizedSummary` (bài "wiki cá nhân" LLM viết lại định kỳ), `lastSynthesizedAt`
- **ActionItem**: `noteId`, `contentItemId`, `description`, `status` (`todo | done`), `remindedAt`

### Thư viện & playlist thật

- **LibraryItem**: `contentItemId`, `savedAt`, `folder`, `readStatus`, `personalNote`
- **YouTubePlaylist**: `youtubePlaylistId`, `title`, `itemCount`, `managedByAI`, `lastSyncedAt`
- **PlaylistOrganizationSuggestion**: `contentItemId`, `suggestedPlaylistId` (có thể là playlist cần tạo mới), `reason`, `suggestionType` (`new_save | misplaced_fix`), `status` (`pending | approved | rejected | applied`)
- **PlaylistActionLog**: `actionType` (`create_playlist | move_item | add_item`), `payload`, `appliedAt`, `triggeredBy`

### Trợ lý chủ động & vận hành

- **DigestRun**: `triggeredBy` (`scheduled_daily | manual`), `startedAt`, `finishedAt`, `newItemsFound`, `status`, `errorSummary`
- **AssistantBriefing**: `digestRunId`, `pickedItemsTiered` (JSON: `topPicks` + `moreIfInterested`), `conversationalScript`, `audioBriefingUrl`, `deliveredAt`, `userRespondedAt`
- **UserAssistantSettings**: `dailyScanTime` (mặc định **21:00 giờ VN** tối hôm trước), `digestDensity` (`it | vua | nhieu`), `autoScanEnabled`
- **FilterPreset**: `filterJson`, `name`, `contentGroup`, `isDefault`
- **ChatSession / ChatMessage**: `toolCalls` (JSON)
- **QuotaUsageLog**: quota YouTube API theo ngày/endpoint
- **JobRun** (mới, vận hành): `jobType`, `status`, `attemptCount`, `lastError`, `idempotencyKey` — pipeline nhiều bước chạy nền cần retry an toàn, không nhân đôi dữ liệu khi chạy lại

---

## Trường phân loại/lọc theo từng chủ đề

### AI (`contentGroup = ai`)
| Trường | Giá trị |
|---|---|
| `aiSubtopic` | `claude_news` · `ai_news_general` · `ai_agent_enterprise` · `coding_experience_howto` · `claude_usage_guide` |
| `sourceReputationTier` | hãng chính thức · chuyên gia cá nhân · diễn đàn cộng đồng · trang tổng hợp |
| Bản thuật lại | Với `blog_article`/`forum_post` không phải tiếng Việt: luôn sinh `NarrationAsset` mức `full_retelling` |

### Triết học (`contentGroup = triet_hoc`)
| Trường | Giá trị |
|---|---|
| `philosophySchool` | `stoic` · `hien_sinh` · `tam_ly_hoc_hien_dai` · `phat_giao_nguyen_thuy` · `khac` |
| `contentForm` | `giang_phap` · `van_dap` · `ung_dung_thuc_hanh` · `phan_tich_hoc_thuat` |
| `authorId` | FK `Author` (`domainType = philosophy_teacher`) — whitelist + LLM mở rộng + `pending_review` |
| `listenerLevel` | `moi_bat_dau` · `chuyen_sau` |
| `misleadingContentFlag` | Cờ LLM gắn khi phát hiện mê tín dị đoan/thương mại hoá tâm linh — lọc loại trừ mặc định |

### Truyện (`contentGroup = truyen`)
| Trường | Giá trị |
|---|---|
| `storyGenre` | `kinh_di` · `vien_tuong` · `phieu_luu_mao_hiem` |
| `storyOrigin` | `viet_nam_sang_tac` · `dich_trung_quoc` · `dich_au_my` · `khac` |
| `intensityLevel` | `nhe_nhang` · `cang_thang` · `kinh_khung` |
| `basedOnTrueStory` | bool |
| `authorId` | FK `Author` (`domainType = story_writer`) — whitelist + LLM mở rộng + `pending_review` |
| `aiGeneratedSuspicionScore` | 0–1, **bộ lọc cứng** (không chỉ trừ điểm) — áp dụng cho cả 3 thể loại truyện, không riêng kinh dị |

### Music (`contentGroup = music`)
| Trường | Giá trị |
|---|---|
| `musicGenre` | `workout_bpm` · `dance` · `piano` · `guitar_rock` · `nhac_vang` |
| `bpm` | số nguyên (chỉ với `workout_bpm`) |
| `bpmBucket` | dải 5 nhịp: `140-145` · `145-150` · `150-155` · `155-160` · `160-165` · `165-170` · `170-175` · `175-180` |
| `bpmConfidence` | `stated_in_title` (cao) · `stated_in_description` · `inferred` (thấp) — **không đoán bừa**, thiếu tin cậy thì để trống thay vì gắn sai |
| `mixLengthBucket` | Chỉ với `workout_bpm`: `>20ph` · `>40ph` · `>1h`. **Các genre khác không khống chế thời lượng** |
| `isContinuousMix` | bool — mix liền mạch vs playlist ghép bài |

> **Lưu ý kỹ thuật quan trọng về BPM**: YouTube không cung cấp BPM trong metadata. Chiến lược: (1) parse từ tiêu đề — phần lớn kênh workout ghi rõ "150 BPM" trong title, độ tin cậy cao nhất; (2) parse từ mô tả; (3) nếu cả hai đều không có, **để trống** `bpm` và không hiện trong bộ lọc BPM. **Không** tải audio về để phân tích nhịp — chi phí compute cao và rủi ro ToS lớn hơn nhiều so với lợi ích, trong khi phần lớn nội dung workout đã tự ghi BPM sẵn.

### New (`contentGroup = new_search`)
| Trường | Giá trị |
|---|---|
| Ô nhập từ khoá | Người dùng tự gõ nội dung muốn tìm, thay đổi theo ngày; lưu thành `AdHocInterest` |
| `autoScan` | Bật/tắt cho từng từ khoá — khi bật, từ khoá được đưa vào lần quét 21:00 hằng ngày và xuất hiện trong bản tin sáng, cho tới khi người dùng gỡ |
| Thời lượng | `5-20ph` · `>20ph` · `>40ph` |
| Chất lượng | `nhieu_luot_xem_nhat` · `ty_le_binh_luan_tren_luot_xem_cao` |

### Bộ lọc chung mọi chuyên mục
Nhóm chủ đề · nguồn (YouTube/Blog/Diễn đàn/Podcast/SoundCloud, đã theo dõi hay chưa) · thời lượng · ngôn ngữ (tiếng Việt gốc / lồng tiếng / phụ đề / ngôn ngữ khác có bản thuật lại tiếng Việt) · lượng người theo dõi nguồn · chỉ số tương tác (like ratio, comment ratio, tốc độ tăng view, độ mới) · loại giọng (người thật / AI TTS / không lời) · trạng thái cá nhân (chưa xem / đang dở / đã xong / từng đánh giá cao) · rating cảm xúc đã gắn · chặn (theo nguồn / tác giả / giọng đọc) · mood-theo-giờ · đã gộp trùng lặp hay chưa.

**Sắp xếp — áp dụng cho mọi chuyên mục** (3 lựa chọn, hiện ở dropdown góc phải danh sách):

| Lựa chọn | Sắp theo | Dùng khi |
|---|---|---|
| **Phù hợp nhất** *(mặc định)* | `finalScore` = điểm chất lượng × hệ số cá nhân hoá | Duyệt hằng ngày, để trợ lý quyết |
| **Chất lượng cao nhất** | `compositeScore` thuần, bỏ qua gu cá nhân | Muốn thấy cái tốt nhất khách quan, kể cả ngoài gu |
| **Mới nhất trước** | `publishedAt` giảm dần | Theo tin nóng, nhất là mục AI |

---

## Chiến lược lấy dữ liệu

- **YouTube Data API v3**: ưu tiên `playlistItems.list` (1 unit) cho kênh đã biết thay vì `search.list` (100 units — chỉ dùng discovery, giới hạn số lần/ngày); batch `videos.list` 50 id/lần; cache `channels.list` TTL vài ngày. `QuotaUsageLog` + circuit-breaker ở 80% ngân sách 10.000 units/ngày (tắt discovery trước, giữ crawl kênh whitelist).
- **Transcript YouTube**: không có API chính thức cho video người khác → `youtubei.js` làm chính, fallback `youtube-transcript`. Cache vĩnh viễn (không bao giờ fetch lại cùng video), throttle, thất bại thì đánh dấu và fallback title+description thay vì crash pipeline.
- **Blog/Diễn đàn AI**: fetch RSS/HTML từ 4 tier nguồn (hãng AI chính thức · blog chuyên gia cá nhân · diễn đàn cộng đồng như Hacker News/Reddit/LessWrong · trang tổng hợp). LLM đọc toàn văn → `NarrationAsset.scriptText` thuật lại đầy đủ bằng tiếng Việt → TTS.
- **Music**: **bỏ qua hoàn toàn bước transcript**. Chỉ lấy metadata + tags + description, parse BPM/genre bằng rule + một lần gọi LLM rẻ (Haiku) để chuẩn hoá genre. Nhờ vậy nhánh Music gần như không tốn chi phí LLM dù số lượng track lớn.
- **Podcast**: RSS công khai, show notes làm nguồn text. **SoundCloud**: API chính thức cho metadata.

---

## Pipeline chấm điểm chất lượng *(phần cốt lõi)*

### Vì sao không thể dùng một công thức chung

Mỗi loại nguồn có bộ chỉ số hoàn toàn khác nhau. Bảng dưới là thực tế những gì lấy được:

| Loại nguồn | Có sẵn | Hoàn toàn không có |
|---|---|---|
| **YouTube** | lượt xem, lượt thích, số bình luận, **nội dung bình luận**, subscriber kênh, tuổi kênh, ngày đăng | lượt không thích (YouTube ẩn từ 2021) |
| **SoundCloud** | lượt nghe, like, repost, bình luận, follower | — |
| **Diễn đàn** (Hacker News, Reddit) | điểm/upvote, số bình luận, tỷ lệ upvote, **nội dung thảo luận**, tuổi tài khoản người đăng | lượt xem |
| **Blog** (Anthropic, Simon W.…) | *(không có gì trên chính trang đó)* | lượt xem, like, bình luận, follower |
| **Podcast RSS** | *(không có gì)* | lượt nghe, đánh giá, subscriber |

So sánh trực tiếp con số tuyệt đối giữa các nguồn là vô nghĩa — 500.000 view YouTube và 300 điểm Hacker News không cùng thang. Nên mọi tín hiệu đều được **chuẩn hoá về percentile trong cùng loại nguồn** trước khi đưa vào công thức.

### Bốn trụ tín hiệu chuẩn hoá

Mọi nguồn đều quy về 4 trụ (giá trị 0–1), chỉ khác nhau ở chỗ lấy dữ liệu từ đâu:

1. **Độ phổ biến** — lượt xem/nghe/upvote, chuẩn hoá percentile *và* chia theo quy mô nguồn (view/subscriber) để kênh nhỏ chất lượng không bị kênh lớn đè.
2. **Độ tương tác** — tỷ lệ bình luận trên lượt xem, tỷ lệ like trên lượt xem. Đây là chỉ số người dùng đặc biệt quan tâm: video nhiều view nhưng gần như không ai bình luận thường là nội dung "xem cho có", còn tỷ lệ bình luận cao nghĩa là có gì đó đáng bàn.
3. **Chất lượng thảo luận** — LLM đọc top bình luận, chấm 0–1 (chi tiết bên dưới).
4. **Uy tín nguồn** — subscriber/follower + trạng thái whitelist + tuổi kênh + mức nhất quán dẫn nguồn tác giả.

### Trọng số cấu hình riêng từng nguồn (trong mục Cài đặt)

Người dùng chỉnh **trọng số xếp hạng, không có ngưỡng loại bỏ cứng** — nội dung điểm thấp bị đẩy xuống cuối chứ không biến mất, để kênh mới/nhỏ vẫn có cơ hội lọt vào tầm mắt. Mỗi loại nguồn một bộ trọng số riêng, tổng 100%. Giá trị mặc định đề xuất:

| Nguồn | Độ phổ biến | Độ tương tác | Chất lượng thảo luận | Uy tín nguồn | Ghi chú |
|---|---|---|---|---|---|
| YouTube | 20% | 30% | 30% | 20% | Nghiêng về tương tác + bình luận thay vì view thuần |
| SoundCloud | 30% | 30% | 20% | 20% | |
| Diễn đàn | 25% | 15% | 45% | 15% | Bản chất diễn đàn nằm ở chất lượng thảo luận |
| Blog | 25%¹ | — | 25%¹ | 30% | ¹Lấy từ tín hiệu phái sinh, +20% cho LLM đánh giá nội dung |
| Podcast | — | — | — | 50% | +50% cho LLM đánh giá nội dung |

**Với Blog và Podcast** (không có chỉ số nào): kết hợp cả hai hướng —
- **Tín hiệu phái sinh**: theo dõi khi bài viết đó được chia sẻ lên Hacker News/Reddit, lấy điểm và số bình luận ở đó làm thước đo thay thế. Đây là cách đo thực tế nhất cho blog kỹ thuật.
- **Uy tín whitelist + LLM đọc nội dung**: dựa vào tier nguồn đã duyệt và đánh giá độ sâu bài viết.

Lưu trong entity **SourceQualityProfile**: `sourceType`, `weights` (JSON), `updatedAt` — versioned để đổi trọng số vẫn tái tính lại điểm cũ được.

### Chất lượng bình luận — hai vòng để tiết kiệm

Gọi API bình luận và cho LLM đọc cho *mọi* nội dung quét được sẽ tốn quota và chi phí vô ích, vì phần lớn bị loại từ vòng đầu.

- **Vòng 1 (rẻ, chạy cho tất cả)**: chấm bằng số liệu thuần — độ phổ biến, độ tương tác, uy tín nguồn. Không gọi API bình luận.
- **Vòng 2 (chỉ ~20 ứng viên đứng đầu mỗi ngày)**: gọi `commentThreads.list` (1 unit/video) lấy top ~20 bình luận → Haiku chấm `discussionQualityScore` 0–1 và gắn cờ tín hiệu: bình luận toàn emoji/spam, bình luận tố "clickbait/tiêu đề sai nội dung", bình luận khen đúng chi tiết cụ thể trong nội dung (dấu hiệu người xem thật sự xem hết).

Lưu **CommentAnalysis**: `contentItemId`, `sampledCount`, `discussionQualityScore`, `signals` (JSON), `analyzedAt`.

Cờ "tố clickbait" từ bình luận là tín hiệu mạnh và rẻ hơn nhiều so với việc bắt LLM đọc toàn bộ transcript để tự phát hiện tiêu đề sai nội dung.

### Điều chỉnh theo từng chuyên mục

Sau khi có điểm nguồn, mỗi chuyên mục nhân thêm hệ số riêng:

- **AI**: cộng điểm cho độ sâu thực hành và tính thời sự (LLM đọc nội dung); `sourceReputationTier` nặng hơn.
- **Triết học**: nặng về uy tín giảng sư/diễn giả; `misleadingContentFlag` (mê tín, thương mại hoá) đẩy xuống mạnh.
- **Truyện**: nặng về uy tín tác giả; `aiGeneratedSuspicionScore` là **bộ lọc cứng đứng ngoài công thức** — đây là ngoại lệ duy nhất có loại bỏ cứng, vì truyện AI viết hàng loạt là thứ người dùng muốn loại hẳn chứ không phải xếp cuối.
- **Music**: không có "chất lượng nội dung" do LLM chấm (đánh giá nhạc bằng chữ là vô nghĩa) — chỉ dùng độ phổ biến, độ tương tác, và mức khớp `bpm`/`musicGenre` với ý định.
- **New**: dùng đúng bộ lọc chất lượng người dùng chọn tại chỗ (nhiều lượt xem nhất / tỷ lệ bình luận-lượt xem cao).

Điểm lưu versioned (`scoreVersion`) để đổi trọng số/prompt vẫn tái tính được.

### Xác thực tác giả (cả 4 domain)

Whitelist seed người dùng nhập (`trustScore = 1.0`) → fuzzy-match tên trích từ nội dung → gặp tên lạ thì LLM đánh giá dựa trên whitelist làm few-shot + tín hiệu công khai (kênh xác minh, mức nhất quán dẫn nguồn qua nhiều video, chất lượng bình luận, tuổi kênh) → **luôn vào `pendingReview`**, chỉ có hiệu lực đầy đủ sau khi người dùng duyệt 1 lần (qua UI hoặc chat).

---

## Cá nhân hoá

- **Thu thập**: `ConsumptionEvent` chi tiết → tổng hợp `ConsumptionSession`; rating 1–5 sao + tag cảm xúc là tín hiệu tường minh, trọng số cao hơn tín hiệu ngầm.
- **Điểm khác biệt của Music**: với video/bài viết, xem lại nhiều lần là hiếm; với nhạc, **nghe lại nhiều lần là tín hiệu tích cực mạnh nhất**. `replayCount` phải được diễn giải khác nhau theo `contentGroup`, nếu dùng chung một công thức sẽ hiểu sai gu nhạc.
- **Cập nhật taste profile**: job định kỳ gửi Claude (profile hiện tại + N phiên gần nhất + feedback tường minh) → profile mới dạng structured output + `freeformSummary` bằng lời tự nhiên, dùng luôn làm context cho chat agent. Lưu versioned để rollback nếu một đợt dữ liệu nhiễu làm lệch gu.
- **Ảnh hưởng ngược vào ranking**: `finalScore = compositeScore × personalizationMultiplier`, cộng nguồn candidate từ semantic search (`ContentEmbedding` qua pgvector) trên các nội dung đã xem hết/đánh giá cao.
- **Cold start**: khi chưa có lịch sử, hệ thống chạy bằng whitelist nguồn/tác giả người dùng nhập lúc setup + bộ lọc mặc định theo chủ đề, và **chủ động hỏi vài câu trong chat** ("thích nghe truyện dài hay ngắn?") thay vì gợi ý ngẫu nhiên trong vài ngày đầu.

---

## Tính năng chính

- **Trợ lý chủ động biết trò chuyện**: mỗi ngày quét ra hàng chục mục — LLM chắt còn vài lựa chọn nổi bật nhất mỗi chủ đề, phần còn lại gấp gọn "xem thêm nếu rảnh"; trình bày dạng **tin nhắn hội thoại tự nhiên + bản audio briefing ngắn**, kèm link bấm là xem/nghe ngay. **Quét tự động 1 lần/ngày** (21:00 giờ VN) **và quét thủ công** bất cứ lúc nào. Hỏi lại "hôm qua gợi ý X bạn xem chưa?", cho chỉnh độ dày gợi ý, cho "để dành" một loại nội dung cho dịp khác (vd truyện kinh dị để cuối tuần).
- **Bù độ trễ tin AI**: đọc blog/diễn đàn uy tín bằng ngôn ngữ gốc bất kỳ → thuật lại đầy đủ tiếng Việt → audio. Kèm trích checklist thực hành có timestamp và so sánh nhiều nguồn cùng chủ đề.
- **Trợ lý ghi chú & trí nhớ**: nút Note khi đang xem/nghe (gõ **hoặc nói** — quan trọng khi ở chế độ audio/lái xe), gắn đúng mốc thời gian; LLM tự gắn nhãn từ note + transcript quanh đó, tự xếp vào `KnowledgeCollection`; định kỳ tổng hợp thành "wiki cá nhân"; tách `ActionItem` và nhắc lại. Hỏi tự nhiên trong chat ("tôi từng xem gì về X chưa?") → trả lời kèm trích dẫn ngược và nhảy đúng phút trong clip nguồn.
- **Tủ sách nguồn/tác giả**: theo dõi 1 tác giả xuyên nhiều kênh, báo khi có nội dung mới; tìm kiếm toàn văn transcript/bài viết đã crawl.
- **Thư viện cá nhân** + **Quản lý playlist YouTube bằng AI**: đề xuất lưu video vào đúng playlist (tạo mới nếu cần), **quét phát hiện video đặt sai chỗ** trong playlist hiện có; mọi ghi thật đều chờ duyệt, có `PlaylistActionLog`, **không bao giờ tự ý xoá playlist**.
- **Audio-only & smart queue**: nghe như podcast; "tôi có 20 phút" → tự xếp hàng đợi vừa khít. Với Music: hàng đợi theo BPM để tập thể thao liên tục.
- **Cá nhân hoá sâu**: rating cảm xúc, hỏi ngược "sao không gợi ý X", mood-theo-giờ, chặn theo giọng đọc cụ thể.
- **Đồng bộ đang-xem-dở giữa máy tính và điện thoại** (`ResumePoint`).
- **Export dữ liệu cá nhân** (note, wiki, taste profile, whitelist) ra file — đây là tài sản tích luỹ nhiều năm, không nên bị khoá cứng trong một DB duy nhất.

---

## Giao diện — bám sát YouTube, làm cả desktop lẫn mobile

- **Desktop**: masthead (hamburger + logo + ô tìm kiếm giữa + nút quét/thông báo/avatar); sidebar trái **thu gọn được thành chỉ còn icon** khi bấm hamburger; grid card thumbnail 16:9; trang xem có **cột phải là danh sách nội dung liên quan** đúng kiểu YouTube; panel filter mở sẵn bên trái kết quả; bảng duyệt playlist nhiều cột.
- **Mobile**: top bar gọn + hàng chip chủ đề cuộn ngang + card full-width; **bottom nav 5 mục**; filter dạng bottom-sheet; nút voice-note lớn dễ bấm; player thu nhỏ (mini-player) khi cuộn.
- **Trang Cài đặt** có thêm khu "Tiêu chí chất lượng theo nguồn": mỗi loại nguồn (YouTube / SoundCloud / Diễn đàn / Blog / Podcast) một thẻ riêng với các thanh trượt trọng số, hiển thị tổng phần trăm và ví dụ trực quan "với trọng số này, video A sẽ xếp trên video B".
- Tailwind v4 + shadcn/ui; kiểm thử thật ở 375px và 1280px mỗi khi có UI mới.

---

## Tech stack

Next.js (App Router, TS) · Prisma · **PostgreSQL + pgvector** (Neon/Supabase) · Auth.js + Google OAuth (1 tài khoản; **write scope `.../auth/youtube`** xin riêng, tách khỏi scope đọc, chỉ bật khi dùng quản lý playlist) · Anthropic SDK (**Sonnet** cho phân loại sâu/chat/thuật lại, **Haiku** cho lọc sơ bộ hàng loạt và chuẩn hoá genre nhạc) · Message Batches API (−50% chi phí) · Prompt caching (whitelist + system prompt lặp lại) · Voyage AI embeddings · Zod v4 · Tailwind v4 + shadcn/ui · YouTube IFrame Player API · TTS tiếng Việt · ASR cho voice note · cron riêng hoặc Vercel Cron.

**Index cần có ngay từ đầu** (dữ liệu sẽ lên hàng chục nghìn dòng trong vài tháng): `ContentItem(contentGroup, publishedAt)`, `ContentItem(sourceId, publishedAt)`, `ContentScore(compositeScore)`, full-text index trên `Transcript.rawText`, và HNSW index cho cột vector.

---

## Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Hết quota YouTube API | Ưu tiên endpoint 1-unit, giới hạn discovery, circuit-breaker ở 80% |
| ToS khi lấy transcript ngoài API chính thức | Throttle, cache vĩnh viễn, không tái phân phối, xử lý graceful khi bị chặn |
| Bản quyền khi thuật lại bài viết | Dùng cá nhân, không xuất bản; LLM **diễn đạt bằng lời văn riêng**, không sao chép câu chữ |
| Chi phí Claude tăng theo lượng nội dung | Two-stage funnel (Haiku lọc → Sonnet đánh giá sâu), Batches API, prompt caching, giới hạn độ dài bài, **Music không đi qua LLM đọc sâu** |
| False positive khi LLM tự phát hiện tác giả mới *(rủi ro cao nhất)* | Bắt buộc `pendingReview` + duyệt tay, kết hợp nhiều tín hiệu độc lập, giữ `aiGeneratedSuspicionScore` tách biệt |
| Thư viện transcript gãy khi YouTube đổi API ngầm | Thư viện bảo trì tích cực, adapter thay được, heartbeat cảnh báo khi tỷ lệ fail tăng |
| Ghi nhầm vào playlist YouTube thật | Luôn đề xuất → duyệt; log đầy đủ; không bao giờ xoá playlist |
| BPM gắn sai làm hỏng buổi tập | `bpmConfidence` rõ ràng, thiếu tin cậy thì để trống thay vì đoán |
| Job nền chạy lại gây nhân đôi dữ liệu | `JobRun.idempotencyKey` + upsert theo `externalId` |
| Từ khoá "New" bật tự quét nhiều làm cạn quota | Mỗi từ khoá = 100 units/ngày; UI hiện rõ chi phí, cảnh báo khi vượt ~10 từ khoá đang bật, và mục New bị tắt trước khi circuit-breaker chạm ngưỡng |
| Chấm điểm lệch vì so số tuyệt đối giữa các nguồn khác nhau | Chuẩn hoá percentile **trong cùng loại nguồn**, không bao giờ so trực tiếp view YouTube với điểm Hacker News |

---

## Roadmap

| Phase | Nội dung |
|---|---|
| **0** | Repo mới, schema `Source`/`ContentItem`/`Author`, Postgres+pgvector, auth 1 tài khoản, YouTube client + `QuotaUsageLog` |
| **1** | YouTube pipeline lõi: ingestion, transcript fetcher, classification 4 nhóm + trường mở rộng, CRUD whitelist thủ công |
| **2** | Blog/Diễn đàn AI + TTS tiếng Việt *(ưu tiên sớm)*: adapter 4 tier nguồn, `NarrationAsset`, tích hợp TTS |
| **3** | Nhánh Music: metadata extractor, parse BPM + `bpmConfidence`, chuẩn hoá genre bằng Haiku |
| **4** | **Engine chấm chất lượng theo nguồn**: 4 trụ tín hiệu chuẩn hoá percentile, `SourceQualityProfile` + UI chỉnh trọng số trong Cài đặt, `CommentAnalysis` vòng 2, `ExternalDiscussion` cho blog/podcast |
| **4b** | Search/Filter API với toàn bộ trường lọc + 3 kiểu sắp xếp + UI duyệt |
| **4c** | Chuyên mục **New**: `AdHocInterest` (ô nhập từ khoá, bật/tắt tự quét), tích hợp vào cron 21:00 + hiển thị chi phí quota |
| **5** | Player + theo dõi hành vi + `ResumePoint` đồng bộ đa thiết bị + rating cảm xúc |
| **6** | Xác thực tác giả nâng cao: LLM auto-discovery + `pendingReview` + tủ sách tác giả + full-text search |
| **7** | Thư viện cá nhân + quản lý playlist YouTube (OAuth write scope) |
| **8** | Trợ lý ghi chú: `Note` (text/voice), auto-tag, `KnowledgeCollection` + wiki, `ActionItem` |
| **9** | Personalization engine: taste profile, embeddings, mood-theo-giờ, cold-start onboarding |
| **10** | Trợ lý chủ động: `DigestRun`, `AssistantBriefing` + audio briefing, dedup, checklist AI |
| **11** | Mở rộng nguồn: Podcast RSS → SoundCloud |
| **12** | Audio-only & smart queue (kể cả hàng đợi theo BPM) |
| **13** | Chat agent tool-use tích hợp toàn bộ API |
| **14** | Vận hành: dashboard quota/chi phí, score versioning, export dữ liệu cá nhân |

---

## File cốt lõi (repo mới)

- `prisma/schema.prisma`
- `src/lib/sources/{youtube,blogForum,podcast,soundcloud}.ts` — cùng 1 interface ingestion
- `src/lib/youtube/client.ts` (quota accounting) · `src/lib/youtube/playlistManager.ts`
- `src/lib/transcript/` · `src/lib/music/bpmParser.ts`
- `src/lib/llm/{classify,score,narrate}.ts` (Zod structured output)
- `src/lib/tts/` · `src/lib/asr/`
- `src/lib/personalization/tasteProfile.ts` · `src/lib/notes/{autoTag,synthesize}.ts`
- `src/app/{watch,explore,library,playlists,notes,chat,settings}/*`
- `src/app/api/cron/{ingest,digest}/route.ts`

---

## Verification

1. `npm run dev` chạy được, `prisma migrate dev` thành công.
2. Seed whitelist cho cả 4 `Author.domainType`.
3. Trigger ingestion YouTube + Blog thủ công → `ContentItem` mới đúng `type`, `QuotaUsageLog` ghi đúng chi phí.
4. Một bài blog tiếng Anh mẫu → `NarrationAsset.scriptText` tiếng Việt đầy đủ + audio TTS phát được.
5. Classification: video truyện AI-generated bị `aiGeneratedSuspicionScore` cao; bài giảng Nguyên thuỷ rơi đúng `triet_hoc` với `philosophySchool` đúng.
6. Music: video tiêu đề "155 BPM Running Mix 1 Hour" → `bpm = 155`, `bpmBucket = 155-160`, `mixLengthBucket = >1h`, `bpmConfidence = stated_in_title`; video không ghi BPM → `bpm` để trống, không lọt vào bộ lọc BPM.
7. Search/Filter với vài tổ hợp filter (chủ đề + trường riêng + nguồn + ngôn ngữ) trả kết quả đúng; đổi qua lại 3 kiểu sắp xếp (Phù hợp nhất / Chất lượng cao nhất / Mới nhất trước) cho thứ tự khác nhau đúng như mong đợi.
7b. Chấm điểm theo nguồn: chỉnh trọng số YouTube trong Cài đặt (vd đẩy "Chất lượng thảo luận" lên 60%) → xếp hạng đổi theo đúng hướng; một video 2 triệu view nhưng bình luận toàn emoji phải xếp dưới video 50 nghìn view có thảo luận thực chất.
7c. `CommentAnalysis` chỉ chạy cho ~20 ứng viên đứng đầu mỗi ngày, không chạy cho toàn bộ — kiểm tra qua `QuotaUsageLog` và số bản ghi sinh ra.
7d. Chuyên mục New: thêm từ khoá "agent memory", bật tự quét → sáng hôm sau có kết quả mới trong bản tin; tắt đi thì lần quét sau không tốn thêm 100 units.
8. Xem 1 video trên desktop, bỏ dở → mở trên mobile thấy `ResumePoint` đúng vị trí.
9. Ghi 1 voice note + 1 text note → ASR đúng, LLM gắn nhãn hợp lý, vào đúng `KnowledgeCollection`.
10. Bật OAuth write → `PlaylistOrganizationSuggestion` sinh đúng (lưu mới + phát hiện đặt sai chỗ), duyệt 1 đề xuất → thay đổi phản ánh đúng trên kênh thật, `PlaylistActionLog` ghi đủ.
11. Chat: "tìm nhạc chạy bộ 160 BPM trên 40 phút" → tool-use gọi đúng Search API, bấm nghe được ngay.
12. Mỗi màn hình UI test ở 375px và 1280px: layout không vỡ, sidebar thu gọn hoạt động, bottom nav mobile đủ lớn để bấm.
