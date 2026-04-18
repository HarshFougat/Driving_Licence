(function ($) {
  "use strict";

  var $screensTrack = $("#screensTrack");
  var $screensViewport = $(".screens-viewport");
  var $screens = $screensTrack.find(".screen");
  var currentScreen = 0;

  function escapeName(name) {
    if (typeof $.escapeSelector === "function") {
      return $.escapeSelector(name);
    }

    return name.replace(/([ #;?%&,.+*~':"!^$[\]()=>|\/@])/g, "\\$1");
  }

  function collectProgressUnits($scope) {
    var units = [];

    $scope.find("[data-question]").each(function () {
      var $question = $(this);

      $question.find('input[type="text"]').each(function () {
        units.push({
          type: "text",
          element: this
        });
      });

      $question.find("select").each(function () {
        units.push({
          type: "select",
          element: this
        });
      });

      var handledRadioGroups = {};
      $question.find('input[type="radio"]').each(function (index) {
        var radioName = String($(this).attr("name") || "");
        var groupKey = radioName || "__unnamed_radio_" + index;

        if (handledRadioGroups[groupKey]) {
          return;
        }

        handledRadioGroups[groupKey] = true;
        units.push({
          type: "radio",
          scope: $question,
          name: radioName,
          element: this
        });
      });
    });

    return units;
  }

  function isProgressUnitComplete(unit) {
    if (unit.type === "text") {
      var typedValue = String($(unit.element).val() || "");
      return typedValue.trim().length >= 3;
    }

    if (unit.type === "select") {
      return Boolean($(unit.element).val());
    }

    if (unit.type === "radio") {
      if (unit.name) {
        var escaped = escapeName(unit.name);
        return (
          unit.scope.find('input[type="radio"][name="' + escaped + '"]:checked').length >
          0
        );
      }

      return $(unit.element).is(":checked");
    }

    return false;
  }

  function addYearOptions(selector, startYear, endYear) {
    var $select = $(selector);

    for (var year = endYear; year >= startYear; year -= 1) {
      $select.append(
        $("<option>", {
          value: String(year),
          text: String(year)
        })
      );
    }
  }

  function resetAllAnswers() {
    $screensTrack.find('input[type="text"]').val("");
    $screensTrack
      .find('input[type="radio"], input[type="checkbox"]')
      .prop("checked", false);
    $screensTrack
      .find('input[type="radio"], input[type="checkbox"]')
      .removeData("checkedBeforeInteraction");
    $screensTrack.find("select").val("");
  }

  function refreshRadioStyles() {
    $(".radio-pill").removeClass("is-checked");
    $('input[type="radio"]:checked').each(function () {
      $(this).closest(".radio-pill").addClass("is-checked");
    });
  }

  function closeAllSelectPanels() {
    $(".custom-select").removeClass("is-open");
    $(".custom-select-trigger").attr("aria-expanded", "false");
  }

  function buildCustomSelect($selectWrap) {
    if ($selectWrap.attr("data-ready") === "true") {
      return;
    }

    var $nativeSelect = $selectWrap.find("select").first();
    var listTitle = $selectWrap.data("listTitle") || "All Options";
    var placeholderText =
      $nativeSelect.find('option[value=""]').first().text() || "Choose option";

    var $trigger = $(
      '<button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false"></button>'
    );
    var $valueText = $('<span class="custom-select-value"></span>').text(
      placeholderText
    );
    var $caret = $('<span class="custom-caret" aria-hidden="true"></span>');
    $trigger.append($valueText, $caret);

    var $panel = $('<div class="custom-select-panel"></div>');
    var $title = $('<div class="custom-select-title"></div>').text(listTitle);
    var $optionsContainer = $('<div class="custom-select-options"></div>');
    $panel.append($title, $optionsContainer);

    $nativeSelect.find("option").each(function () {
      var $option = $(this);
      var optionValue = $option.val();
      var optionText = $option.text();

      if (!optionValue) {
        return;
      }

      var $customOption = $('<button type="button" class="custom-option"></button>')
        .attr("data-value", optionValue)
        .text(optionText);

      if (String($nativeSelect.val()) === String(optionValue)) {
        $customOption.addClass("is-selected");
        $trigger.addClass("has-value");
        $valueText.text(optionText);
      }

      $optionsContainer.append($customOption);
    });

    $selectWrap.append($trigger, $panel);
    $selectWrap.attr("data-ready", "true");

    $trigger.on("click", function (event) {
      event.stopPropagation();
      var willOpen = !$selectWrap.hasClass("is-open");
      closeAllSelectPanels();

      if (willOpen) {
        $selectWrap.addClass("is-open");
        $trigger.attr("aria-expanded", "true");
      }
    });

    $panel.on("click", function (event) {
      event.stopPropagation();
    });

    $optionsContainer.on("click", ".custom-option", function () {
      var $chosenOption = $(this);
      var selectedValue = String($chosenOption.data("value"));
      var selectedText = $chosenOption.text();

      $nativeSelect.val(selectedValue).trigger("change");
      $optionsContainer.find(".custom-option").removeClass("is-selected");
      $chosenOption.addClass("is-selected");
      $trigger.addClass("has-value");
      $valueText.text(selectedText);
      closeAllSelectPanels();
    });

    $nativeSelect.on("change", function () {
      var newValue = String($nativeSelect.val() || "");
      var displayText = placeholderText;

      if (newValue) {
        $nativeSelect.find("option").each(function () {
          if (String($(this).val()) === newValue) {
            displayText = $(this).text();
          }
        });
      }

      if (newValue) {
        $trigger.addClass("has-value");
      } else {
        $trigger.removeClass("has-value");
      }

      $valueText.text(displayText);
      $optionsContainer.find(".custom-option").each(function () {
        $(this).toggleClass(
          "is-selected",
          String($(this).data("value")) === newValue
        );
      });
    });
  }

  function screenIsComplete(screenIndex) {
    var screenUnits = collectProgressUnits($screens.eq(screenIndex));
    if (!screenUnits.length) {
      return false;
    }

    for (var index = 0; index < screenUnits.length; index += 1) {
      if (!isProgressUnitComplete(screenUnits[index])) {
        return false;
      }
    }

    return true;
  }

  function updateProgressBar() {
    var units = collectProgressUnits($screensTrack);
    var totalUnits = units.length;
    var completedUnits = 0;

    for (var index = 0; index < units.length; index += 1) {
      if (isProgressUnitComplete(units[index])) {
        completedUnits += 1;
      }
    }

    var percent = totalUnits
      ? Math.round((completedUnits / totalUnits) * 100)
      : 0;

    $("#progressFill").css("width", percent + "%");
  }

  function goToScreen(nextScreenIndex) {
    var maxIndex = $screens.length - 1;
    var clampedIndex = Math.max(0, Math.min(nextScreenIndex, maxIndex));
    currentScreen = clampedIndex;
    $screensTrack.css("transform", "translateX(-" + clampedIndex * 100 + "%)");
    syncViewportHeight();
  }

  function syncViewportHeight() {
    var $activeScreen = $screens.eq(currentScreen);
    if (!$activeScreen.length) {
      return;
    }

    $screensViewport.css("height", $activeScreen.outerHeight(true) + "px");
  }

  function maybeAdvanceScreen() {
    if (currentScreen >= $screens.length - 1) {
      return;
    }

    if (screenIsComplete(currentScreen)) {
      goToScreen(currentScreen + 1);
    }
  }

  function initializeCustomSelects() {
    $("[data-select]").each(function () {
      buildCustomSelect($(this));
    });
  }

  function initializeDynamicQuestionObserver() {
    var target = document.getElementById("screensTrack");

    if (!target || typeof MutationObserver === "undefined") {
      return;
    }

    var observer = new MutationObserver(function () {
      initializeCustomSelects();
      refreshRadioStyles();
      updateProgressBar();
      syncViewportHeight();
    });

    observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  function bindEvents() {
    $(document).on("click", function () {
      closeAllSelectPanels();
    });

    $(document).on(
      "pointerdown mousedown touchstart",
      "#screensTrack [data-question] .radio-pill",
      function () {
        var $pill = $(this);
        var $radio = $pill.find('input[type="radio"]').first();
        $pill.data("checkedBeforeInteraction", $radio.is(":checked"));
      }
    );

    $(document).on(
      "click",
      "#screensTrack [data-question] .radio-pill",
      function (event) {
        var $pill = $(this);
        var $radio = $pill.find('input[type="radio"]').first();

        if (!$radio.length) {
          return;
        }

        if ($pill.data("checkedBeforeInteraction")) {
          event.preventDefault();
          $radio.prop("checked", false);
          $pill.data("checkedBeforeInteraction", false);
          $radio.trigger("change");
        }
      }
    );

    $(document).on(
      "input",
      "#screensTrack [data-question] input[type=\"text\"]",
      function () {
        updateProgressBar();
        maybeAdvanceScreen();
      }
    );

    $(document).on(
      "change",
      "#screensTrack [data-question] input[type=\"radio\"]",
      function () {
        refreshRadioStyles();
        updateProgressBar();
        maybeAdvanceScreen();
      }
    );

    $(document).on(
      "change",
      "#screensTrack [data-question] select",
      function () {
        updateProgressBar();
        maybeAdvanceScreen();
      }
    );

    $(document).on("click", ".js-back", function () {
      goToScreen(currentScreen - 1);
    });

    $(window).on("pageshow", function () {
      resetAllAnswers();
      $screensTrack.find("select").trigger("change");
      closeAllSelectPanels();
      refreshRadioStyles();
      updateProgressBar();
      goToScreen(0);
    });

    $(window).on("resize", function () {
      syncViewportHeight();
    });
  }

  function init() {
    var thisYear = new Date().getFullYear();
    addYearOptions("#issuedYear", 1980, thisYear);
    addYearOptions("#expiredYear", 1980, thisYear + 15);

    resetAllAnswers();
    initializeCustomSelects();
    $screensTrack.find("select").trigger("change");
    refreshRadioStyles();
    bindEvents();
    initializeDynamicQuestionObserver();
    updateProgressBar();
    goToScreen(0);
    syncViewportHeight();
  }

  $(init);
})(jQuery);
