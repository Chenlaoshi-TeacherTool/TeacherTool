# Worksheet generator translations (Azure Translator)

The worksheet generator (`/teaching-tools/worksheet-generator`) fills in English
from CC-CEDICT in the browser. Thai, Vietnamese, Russian, Spanish and French come
from Azure AI Translator through `POST /api/translate-words`. Words are sent
only when a teacher clicks **补全拼音和翻译**.

Until the key is set, the page still works: the button fills pinyin and English
and shows "Translation is not set up on this server yet". Teachers can still
type translations by hand.

## One-time setup (about 5 minutes)

1. In the Azure portal, choose **Create a resource → Translator**.
   - Resource group: the same one as the `chenlaoshi-teachingtools` App Service.
   - Region: any (for example *East US*). Write it down.
   - Pricing tier: **Free F0**, which allows 2 million characters per month.
     A 20-word list in 4 languages uses about 40 characters, because only the
     Chinese words are counted.
2. Open the new Translator resource → **Keys and Endpoint**. Copy **KEY 1** and
   the **Location/Region** value (for example `eastus`).
3. Open the App Service **chenlaoshi-teachingtools** → **Settings → Environment
   variables → App settings**. Add:

   | Name | Value |
   |------|-------|
   | `AZURE_TRANSLATOR_KEY` | KEY 1 from step 2 |
   | `AZURE_TRANSLATOR_REGION` | the region from step 2, e.g. `eastus` |

   Click **Apply**. The app restarts on its own.
4. Check that it works: open the worksheet generator, tick 泰语, and click
   **补全拼音和翻译**. Each word line should gain a `th=…` part.

`AZURE_TRANSLATOR_ENDPOINT` is optional. Set it only if you use a custom-domain
Translator endpoint.

## Limits built into the server

- At most 60 words and 4 languages per request. The page splits longer lists
  into batches of 60.
- Each visitor IP can make 30 requests per 10 minutes, so one person can't use
  up the free tier.
- Translations are cached in memory (up to 5,000 word/language pairs). A word
  that has already been translated is not sent to Azure again until the app
  restarts.

## How translations are stored on the page

Extra languages are saved in the word line as tagged parts after English, so
teachers can correct them by hand:

```
爸爸 | bà ba | dad | th=พ่อ | vi=bố | ru=папа
```
