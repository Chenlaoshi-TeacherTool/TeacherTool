(function () {
  "use strict";

  const form = document.querySelector("#packet-form");
  const sampleButton = document.querySelector("#load-example");
  const questionsInput = document.querySelector("#questionsText");
  const questionCount = document.querySelector("#question-count");
  const status = document.querySelector("#generation-status");

  if (!form || !sampleButton || !questionsInput || !questionCount || !status) {
    return;
  }

  function parseNumberedQuestions(value) {
    const questions = [];
    let currentQuestion = "";

    value.split(/\r?\n/).forEach((line) => {
      const trimmedLine = line.trim();
      const numberedQuestion = trimmedLine.match(/^\d+\s*(?:[.、)）:：-])\s*(.+)$/);

      if (numberedQuestion) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        currentQuestion = numberedQuestion[1].trim();
      } else if (trimmedLine && currentQuestion) {
        currentQuestion += ` ${trimmedLine}`;
      }
    });

    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    return questions;
  }

  function updateQuestionCount() {
    const count = parseNumberedQuestions(questionsInput.value).length;
    questionCount.textContent = count
      ? `${count} numbered question${count === 1 ? "" : "s"} detected.`
      : "No numbered questions detected yet.";
    questionsInput.setCustomValidity("");
  }

  function loadExample() {
    form.elements.title.value = "小猫要吃鱼";
    form.elements.englishTitle.value = "The Kitten Wants Fish";
    form.elements.story.value = [
      "小猫很饿。小猫想吃鱼。",
      "小猫去河边。河里有很多鱼。",
      "小猫要吃鱼，可是小猫怕水。",
      "一只鸟说：“我可以帮你。”",
      "鸟从河里拿出一条大鱼。",
      "小猫很高兴，说：“谢谢你！”",
      "小猫和鸟一起吃鱼。",
    ].join("\n");
    questionsInput.value = [
      "1. 小猫想吃什么？",
      "2. 小猫去了哪里？",
      "3. 河里有什么？",
      "4. 小猫怕什么？",
      "5. 谁帮了小猫？",
    ].join("\n");
    updateQuestionCount();
    status.dataset.state = "";
    status.textContent = "Example loaded. You can edit any field before generating the Word document.";
  }

  function getPacketData() {
    return {
      title: form.elements.title.value,
      englishTitle: form.elements.englishTitle.value,
      story: form.elements.story.value,
      questions: parseNumberedQuestions(questionsInput.value),
    };
  }

  async function downloadPacket(event) {
    event.preventDefault();
    const packet = getPacketData();

    if (!packet.questions.length) {
      questionsInput.setCustomValidity("Please start every question with a number, such as 1. or 2.");
      questionsInput.reportValidity();
      questionCount.textContent = "Add a number before each question so the builder can identify it.";
      return;
    }

    if (!form.reportValidity()) {
      return;
    }

    if (!window.docx || !window.IndependentReadingDocx) {
      status.textContent = "The document generator did not load. Please refresh and try again.";
      status.dataset.state = "error";
      return;
    }

    const generateButton = form.querySelector('button[type="submit"]');
    generateButton.disabled = true;
    status.dataset.state = "working";
    status.textContent = "Building your Word document…";

    try {
      const documentFile = window.IndependentReadingDocx.createDocument(packet);
      const blob = await window.docx.Packer.toBlob(documentFile);
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.href = url;
      link.download = window.IndependentReadingDocx.fileName(packet.title);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      status.dataset.state = "success";
      status.textContent = "Your Word document is ready and has been downloaded.";
    } catch (error) {
      console.error(error);
      status.dataset.state = "error";
      status.textContent = "We could not generate the Word document. Please refresh and try again.";
    } finally {
      generateButton.disabled = false;
    }
  }

  questionsInput.addEventListener("input", updateQuestionCount);
  sampleButton.addEventListener("click", loadExample);
  form.addEventListener("submit", downloadPacket);
  updateQuestionCount();
})();
