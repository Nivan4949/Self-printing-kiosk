const Keyboard = {
  elements: {
    main: null,
    alphabetContainerEN: null,
    alphabetContainerMN: null,
    alphabetContainerSP: null,
    numbersContainer: null,
    keysEN: [],
    keysMN: [],
    keysSP: [],
  },

  eventHandlers: {
    onInput: null,
    onClose: null,
  },

  properties: {
    value: "",
    capsLock: false,
    lang: "",
    specialChars: false,
  },

  init() {
    // Create main elements
    this.elements.main = document.createElement("div");
    this.elements.alphabetContainerEN = document.createElement("div");
    this.elements.alphabetContainerMN = document.createElement("div");
    this.elements.alphabetContainerSP = document.createElement("div");
    this.elements.numbersContainer = document.createElement("div");

    // Setup main elements
    this.elements.main.classList.add("keyboard", "keyboard--hidden");
    this.elements.alphabetContainerEN.classList.add("keyboard__keys");
    this.elements.alphabetContainerMN.classList.add("keyboard__keys");
    this.elements.alphabetContainerSP.classList.add("keyboard__keys");
    this.elements.numbersContainer.classList.add("keyboard__keys");
    this.elements.alphabetContainerEN.appendChild(this._createAlphabet()[0]);
    this.elements.alphabetContainerMN.appendChild(this._createAlphabet()[1]);
    this.elements.alphabetContainerSP.appendChild(this._createAlphabet()[2]);
    this.elements.numbersContainer.appendChild(this._createNumbers());
    this.elements.keysEN =
      this.elements.alphabetContainerEN.querySelectorAll(".keyboard__key");
    this.elements.keysMN =
      this.elements.alphabetContainerMN.querySelectorAll(".keyboard__key");
    this.elements.keysSP =
      this.elements.alphabetContainerMN.querySelectorAll(".keyboard__key");

    // Add to DOM
    if (!this.properties.lang || this.properties.lang == "en") {
      this.elements.main.appendChild(this.elements.alphabetContainerEN);
      this.properties.lang = "en";
    } else if (this.properties.lang == "mn") {
      this.elements.main.appendChild(this.elements.alphabetContainerMN);
    } else if ((this.properties.lang = "sp")) {
      this.elements.main.appendChild(this.elements.alphabetContainerSP);
    }

    this.elements.main.appendChild(this.elements.numbersContainer);
    document.body.appendChild(this.elements.main);

    document.querySelectorAll(".use-keyboard-input").forEach((element) => {
      element.addEventListener("focus", () => {
        this.open(element.value, (currentValue) => {
          element.value = currentValue;
        });
      });
    });
  },

  _createNumbers() {
    const numbersFragment = document.createDocumentFragment();
    const keyLayout = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

    keyLayout.forEach((key) => {
      const keyElementEN = document.createElement("button");
      const insertLineBreak = ["3", "6", "9"].indexOf(key) !== -1;

      keyElementEN.setAttribute("type", "button");
      keyElementEN.classList.add("keyboard__key");

      keyElementEN.addEventListener("click", () => {
        this.properties.value += key;
        this._triggerEvent("onInput");
      });

      numbersFragment.appendChild(keyElementEN);

      if (insertLineBreak) {
        numbersFragment.appendChild(document.createElement("br"));
      }

      keyElementEN.textContent = key;
    });

    return numbersFragment;
  },

  _createAlphabet() {
    const alphabetFragmentEN = document.createDocumentFragment();
    const alphabetFragmentMN = document.createDocumentFragment();
    const alphabetFragmentSP = document.createDocumentFragment();

    const keyLayoutEN = [
      "q",
      "w",
      "e",
      "r",
      "t",
      "y",
      "u",
      "i",
      "o",
      "p",

      "a",
      "s",
      "d",
      "f",
      "g",
      "h",
      "j",
      "k",
      "l",

      "caps",
      "z",
      "x",
      "c",
      "v",
      "b",
      "n",
      "m",
      "backspace",

      "chars",
      "lang",
      "space",
      "enter",
    ];

    const keyLayoutMN = [
      "ф",
      "ц",
      "у",
      "ж",
      "э",
      "н",
      "г",
      "ш",
      "ү",
      "з",
      "к",
      "ъ",
      "щ",
      "е",

      "й",
      "ы",
      "б",
      "ө",
      "а",
      "х",
      "р",
      "о",
      "л",
      "д",
      "п",
      "backspace",

      "caps",
      "я",
      "ч",
      "ё",
      "с",
      "м",
      "и",
      "т",
      "ь",
      "в",
      "ю",
      

      "chars",
      "lang",
      "space",
      "enter",
    ];

    const keyLayoutSP = [
      "~",
      "`",
      "!",
      "@",
      "#",
      "$",
      "%",
      "^",
      "&",
      "*",
      "(",
      ")",

      "-",
      "_",
      "+",
      "=",
      "{",
      "}",
      '"',
      "'",
      "<",
      ">",
      "backspace",

      "[",
      "]",
      "|",
      "\\",
      "/",
      ":",
      ";",
      "enter",

      "chars",
      "lang",
      "space",
      ",",
      ".",
      "?",
    ];

    // Creates HTML for an icon
    const createIconHTML = (src) => {
      return `<img src="${src}" alt="key icon" />`;
    };

    // Init EN layout
    keyLayoutEN.forEach((key) => {
      const keyElementEN = document.createElement("button");
      const insertLineBreak =
        ["backspace", "p", "enter", "l"].indexOf(key) !== -1;

      // Add attributes/classes
      keyElementEN.setAttribute("type", "button");
      keyElementEN.classList.add("keyboard__key");

      switch (key) {
        case "enter":
          keyElementEN.classList.add("keyboard__key--enter");
          keyElementEN.innerHTML = "Enter";
          keyElementEN.addEventListener("click", () => {
            document.querySelector("#password").focus();
            this._triggerEvent("onInput");
          });
          break;

        case "backspace":
          keyElementEN.classList.add("keyboard__key--special");
          keyElementEN.innerHTML = createIconHTML("./icons/backspace.svg");
          keyElementEN.addEventListener("click", () => {
            this.properties.value = this.properties.value.substring(
              0,
              this.properties.value.length - 1
            );
            this._triggerEvent("onInput");
          });
          break;

        case "caps":
          keyElementEN.classList.add(
            "keyboard__key--special",
            "keyboard__key--activatable"
          );
          keyElementEN.innerHTML = createIconHTML("./icons/shift.svg");
          keyElementEN.addEventListener("click", () => {
            this._toggleCapsLock();
            keyElementEN.classList.toggle(
              "keyboard__key--active",
              this.properties.capsLock
            );
          });
          break;

        case "space":
          keyElementEN.classList.add("keyboard__key--space");
          keyElementEN.innerHTML = createIconHTML("./icons/space.svg");
          keyElementEN.addEventListener("click", () => {
            this.properties.value += " ";
            this._triggerEvent("onInput");
          });
          break;

        case "chars":
          keyElementEN.classList.add("keyboard__key--special");
          keyElementEN.innerHTML = "{&=";
          keyElementEN.addEventListener("click", () => {
            this.elements.main.removeChild(this.elements.alphabetContainerEN);
            if (!this.properties.specialChars) {
              this.elements.main.insertBefore(
                this.elements.alphabetContainerSP,
                this.elements.numbersContainer
              );
              this.properties.specialChars = true;
            } 
          });
          break;

        case "lang":
          keyElementEN.classList.add("keyboard__key--special");
          keyElementEN.innerHTML = createIconHTML("./icons/language.svg");
          keyElementEN.addEventListener("click", () => {
            if (this.properties.lang == "en") {
              this.elements.main.removeChild(this.elements.alphabetContainerEN);
              this.elements.main.insertBefore(
                this.elements.alphabetContainerMN,
                this.elements.numbersContainer
              );
              this.properties.lang = "mn";
            } else if (this.properties.lang == "mn") {
              this.elements.main.removeChild(this.elements.alphabetContainerMN);
              this.elements.main.insertBefore(
                this.elements.alphabetContainerEN,
                this.elements.numbersContainer
              );
              this.properties.lang = "en";
            }
          });
          break;

        default:
          keyElementEN.textContent = key.toLowerCase();
          keyElementEN.addEventListener("click", () => {
            this.properties.value += this.properties.capsLock
              ? key.toUpperCase()
              : key.toLowerCase();
            this._triggerEvent("onInput");
          });
          break;
      }

      alphabetFragmentEN.appendChild(keyElementEN);

      if (insertLineBreak) {
        alphabetFragmentEN.appendChild(document.createElement("br"));
      }
    });

    //Init MN layout
    keyLayoutMN.forEach((key) => {
      const keyElementMN = document.createElement("button");
      const insertLineBreak = ["щ", "ю", "backspace"].indexOf(key) !== -1;

      // Add attributes/classes
      keyElementMN.setAttribute("type", "button");
      keyElementMN.classList.add("keyboard__key");

      switch (key) {
        case "enter":
          keyElementMN.classList.add("keyboard__key--enter");
          keyElementMN.innerHTML = "Enter";
          keyElementMN.addEventListener("click", () => {
            document.querySelector("#password").focus();
            this._triggerEvent("onInput");
          });
          break;

        case "backspace":
          keyElementMN.classList.add("keyboard__key--special");
          keyElementMN.innerHTML = createIconHTML("./icons/backspace.svg");
          keyElementMN.addEventListener("click", () => {
            this.properties.value = this.properties.value.substring(
              0,
              this.properties.value.length - 1
            );
            this._triggerEvent("onInput");
          });
          break;

        case "caps":
          keyElementMN.classList.add(
            "keyboard__key--special",
            "keyboard__key--activatable"
          );
          keyElementMN.innerHTML = createIconHTML("./icons/shift.svg");
          keyElementMN.addEventListener("click", () => {
            this._toggleCapsLock();
            keyElementMN.classList.toggle(
              "keyboard__key--active",
              this.properties.capsLock
            );
          });
          break;

        case "space":
          keyElementMN.classList.add("keyboard__key--space");
          keyElementMN.innerHTML = createIconHTML("./icons/space.svg");
          keyElementMN.addEventListener("click", () => {
            this.properties.value += " ";
            this._triggerEvent("onInput");
          });
          break;

        case "chars":
          keyElementMN.classList.add("keyboard__key--special");
          keyElementMN.innerHTML = "{&=";
          keyElementMN.addEventListener("click", () => {
            this.elements.main.removeChild(this.elements.alphabetContainerMN);
            if (!this.properties.specialChars) {
              this.elements.main.insertBefore(
                this.elements.alphabetContainerSP,
                this.elements.numbersContainer
              );
              this.properties.specialChars = true;
            } 
          });
          break;

        case "lang":
          keyElementMN.classList.add("keyboard__key--special");
          keyElementMN.innerHTML = createIconHTML("./icons/language.svg");
          keyElementMN.addEventListener("click", () => {
            if (this.properties.lang == "en") {
              this.elements.main.removeChild(this.elements.alphabetContainerEN);
              this.elements.main.insertBefore(
                this.elements.alphabetContainerMN,
                this.elements.numbersContainer
              );
              this.properties.lang = "mn";
            } else if (this.properties.lang == "mn") {
              this.elements.main.removeChild(this.elements.alphabetContainerMN);
              this.elements.main.insertBefore(
                this.elements.alphabetContainerEN,
                this.elements.numbersContainer
              );
              this.properties.lang = "en";
            }
          });
          break;

        default:
          keyElementMN.textContent = key.toLowerCase();
          keyElementMN.addEventListener("click", () => {
            this.properties.value += this.properties.capsLock
              ? key.toUpperCase()
              : key.toLowerCase();
            this._triggerEvent("onInput");
          });
          break;
      }

      alphabetFragmentMN.appendChild(keyElementMN);

      if (insertLineBreak) {
        alphabetFragmentMN.appendChild(document.createElement("br"));
      }
    });

    // Init special keys layout
    keyLayoutSP.forEach((key) => {
      const keyElementSP = document.createElement("button");
      const insertLineBreak = [")", "backspace", "enter"].indexOf(key) !== -1;

      // Add attributes/classes
      keyElementSP.setAttribute("type", "button");
      keyElementSP.classList.add("keyboard__key");

      switch (key) {
        case "enter":
          keyElementSP.classList.add("keyboard__key--enter");
          keyElementSP.innerHTML = "Enter";
          keyElementSP.addEventListener("click", () => {
            document.querySelector("#password").focus();
            this._triggerEvent("onInput");
          });
          break;

        case "backspace":
          keyElementSP.classList.add("keyboard__key--special");
          keyElementSP.innerHTML = createIconHTML("./icons/backspace.svg");
          keyElementSP.addEventListener("click", () => {
            this.properties.value = this.properties.value.substring(
              0,
              this.properties.value.length - 1
            );
            this._triggerEvent("onInput");
          });
          break;

        case "space":
          keyElementSP.classList.add("keyboard__key--space");
          keyElementSP.innerHTML = createIconHTML("./icons/space.svg");
          keyElementSP.addEventListener("click", () => {
            this.properties.value += " ";
            this._triggerEvent("onInput");
          });
          break;

        case "chars":
          keyElementSP.classList.add("keyboard__key--special");
          keyElementSP.innerHTML = "{&=";
          keyElementSP.addEventListener("click", () => {
            this.elements.main.removeChild(this.elements.alphabetContainerEN);
            if (!this.properties.specialChars) {
              this.elements.main.insertBefore(
                this.elements.alphabetContainerSP,
                this.elements.numbersContainer
              );
              this.properties.specialChars = true;
            } 
          });
          break;

        case "lang":
          keyElementSP.classList.add("keyboard__key--special");
          keyElementSP.innerHTML = createIconHTML("./icons/language.svg");
          keyElementSP.addEventListener("click", () => {
            this.elements.main.removeChild(this.elements.alphabetContainerSP);
            if (this.properties.lang == "en") {
              this.elements.main.insertBefore(
                this.elements.alphabetContainerEN,
                this.elements.numbersContainer
              );
              this.properties.lang = "en";
            } else if (this.properties.lang == "mn") {
              this.elements.main.insertBefore(
                this.elements.alphabetContainerMN,
                this.elements.numbersContainer
              );
              this.properties.lang = "mn";
            }
            this.properties.specialChars = false;
          });
          break;

        default:
          keyElementSP.textContent = key.toLowerCase();
          keyElementSP.addEventListener("click", () => {
            this.properties.value += key;
            this._triggerEvent("onInput");
          });
          break;
      }

      alphabetFragmentSP.appendChild(keyElementSP);

      if (insertLineBreak) {
        alphabetFragmentSP.appendChild(document.createElement("br"));
      }
    });

    return [alphabetFragmentEN, alphabetFragmentMN, alphabetFragmentSP];
  },

  _triggerEvent(handlerName) {
    if (typeof this.eventHandlers[handlerName] == "function") {
      this.eventHandlers[handlerName](this.properties.value);
    }
  },

  _toggleCapsLock() {
    this.properties.capsLock = !this.properties.capsLock;

    for (const key of this.elements.keysEN) {
      if (key.childElementCount === 0) {
        key.textContent = this.properties.capsLock
          ? key.textContent.toUpperCase()
          : key.textContent.toLowerCase();
      }
    }

    for (const key of this.elements.keysMN) {
      if (key.childElementCount === 0) {
        key.textContent = this.properties.capsLock
          ? key.textContent.toUpperCase()
          : key.textContent.toLowerCase();
      }
    }
  },

  open(initialValue, onInput, onClose) {
    this.properties.value = initialValue || "";
    this.eventHandlers.onInput = onInput;
    this.eventHandlers.onClose = onClose;
    this.elements.main.classList.remove("keyboard--hidden");
  },

  close() {
    this.properties.value = "";
    this.eventHandlers.onInput = onInput;
    this.eventHandlers.onClose = onClose;
    this.elements.main.classList.add("keyboard--hidden");
  },
};

window.addEventListener("DOMContentLoaded", () => {
  Keyboard.init();
});
