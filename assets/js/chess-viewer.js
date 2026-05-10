(function () {
  var SELECTOR = "pre > code.language-pgn, pre > code.language-chess-pgn";
  var pieceTheme = "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png";
  var viewerId = 0;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function createChess(fen) {
    if (!window.Chess) {
      return null;
    }
    return fen ? new window.Chess(fen) : new window.Chess();
  }

  function loadPgn(game, pgn) {
    if (typeof game.load_pgn === "function") {
      return game.load_pgn(pgn, { sloppy: true });
    }
    if (typeof game.loadPgn === "function") {
      return game.loadPgn(pgn, { strict: false });
    }
    return false;
  }

  function getHeaders(game) {
    if (typeof game.header === "function") {
      return game.header();
    }
    if (typeof game.getHeaders === "function") {
      return game.getHeaders();
    }
    return {};
  }

  function getHistory(game, verbose) {
    if (typeof game.history !== "function") {
      return [];
    }
    return game.history(verbose ? { verbose: true } : undefined);
  }

  function fullMoveNumber(fen) {
    var parts = fen.split(" ");
    var moveNumber = parseInt(parts[5], 10);
    return Number.isNaN(moveNumber) ? 1 : moveNumber;
  }

  function parsePgn(pgn) {
    var parsed = createChess();
    var rewind = createChess();
    if (!parsed || !rewind) {
      throw new Error("Chess libraries did not load.");
    }
    if (!loadPgn(parsed, pgn) || !loadPgn(rewind, pgn)) {
      throw new Error("Could not parse this PGN.");
    }
    while (getHistory(rewind).length > 0) {
      rewind.undo();
    }
    return {
      headers: getHeaders(parsed),
      initialFen: rewind.fen(),
      initialFullMove: fullMoveNumber(rewind.fen()),
      moves: getHistory(parsed, true)
    };
  }

  function makeButton(label, className) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (className) {
      button.className = className;
    }
    return button;
  }

  function showError(pre, message) {
    var error = document.createElement("div");
    error.className = "chess-viewer__error";
    error.textContent = message;
    pre.replaceWith(error);
  }

  function extractCaption(pre) {
    var caption = pre.nextElementSibling;
    if (!caption || !caption.classList.contains("chess-viewer-caption")) {
      return null;
    }
    caption.classList.remove("chess-viewer-caption");
    caption.classList.add("chess-viewer__caption");
    return caption;
  }

  function useLinearPieceAnimation() {
    if (window.jQuery && window.jQuery.easing && window.jQuery.easing.linear) {
      window.jQuery.easing.swing = window.jQuery.easing.linear;
      window.jQuery.easing._default = "linear";
    }
  }

  function renderMoveList(moves, moveList, goTo, initialFullMove) {
    var currentMove = initialFullMove - 1;
    var pendingWhite = null;
    var buttons = [];

    moves.forEach(function (move, index) {
      if (move.color === "w" || !pendingWhite) {
        currentMove = move.color === "w" ? move.move_number || currentMove + 1 : currentMove + 1;

        var number = document.createElement("span");
        number.className = "chess-viewer__move-number";
        number.textContent = move.color === "w" ? currentMove + "." : currentMove + "...";
        moveList.appendChild(number);

        pendingWhite = document.createElement("span");
        if (move.color !== "w") {
          moveList.appendChild(pendingWhite);
        }
      }

      var button = makeButton(move.san, "chess-viewer__move");
      button.dataset.ply = String(index + 1);
      button.addEventListener("click", function () {
        goTo(index + 1);
      });
      buttons.push(button);
      moveList.appendChild(button);

      if (move.color === "b") {
        pendingWhite = null;
      }
    });

    return buttons;
  }

  function plyFromHref(href) {
    var match = href.match(/^#ply-(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  function bindPlyLinks(viewer, goTo, moveCount) {
    Array.prototype.forEach.call(viewer.querySelectorAll('a[href^="#ply-"]'), function (link) {
      var targetPly = plyFromHref(link.getAttribute("href"));
      if (!targetPly || targetPly > moveCount) {
        return;
      }

      link.classList.add("chess-viewer__ply-link");
      link.addEventListener("click", function (event) {
        event.preventDefault();
        goTo(targetPly);
      });
    });
  }

  function renderViewer(code) {
    var pre = code.parentElement;
    var pgn = code.textContent.trim();
    if (!pgn) {
      showError(pre, "This PGN block is empty.");
      return;
    }
    if (!window.Chess || !window.Chessboard) {
      showError(pre, "Chess viewer dependencies did not load.");
      return;
    }

    var parsed;
    try {
      parsed = parsePgn(pgn);
    } catch (error) {
      showError(pre, error.message);
      return;
    }

    viewerId += 1;

    var caption = extractCaption(pre);
    var viewer = document.createElement("section");
    var body = document.createElement("div");
    var boardEl = document.createElement("div");
    var panel = document.createElement("div");
    var players = document.createElement("div");
    var whitePlayer = document.createElement("span");
    var blackPlayer = document.createElement("span");
    var controls = document.createElement("div");
    var moveList = document.createElement("div");

    var previous = makeButton("←");
    var next = makeButton("→");

    var boardId = "chess-viewer-board-" + viewerId;
    var game = createChess(parsed.initialFen);
    var ply = 0;
    var buttons = [];

    viewer.className = "chess-viewer";
    body.className = "chess-viewer__body";
    boardEl.className = "chess-viewer__board";
    panel.className = "chess-viewer__panel";
    players.className = "chess-viewer__players";
    controls.className = "chess-viewer__controls";
    moveList.className = "chess-viewer__moves";
    boardEl.id = boardId;
    previous.setAttribute("aria-label", "Previous move");
    next.setAttribute("aria-label", "Next move");

    var white = parsed.headers.White || "White";
    var black = parsed.headers.Black || "Black";
    whitePlayer.textContent = "White: " + white;
    blackPlayer.textContent = "Black: " + black;
    players.appendChild(whitePlayer);
    players.appendChild(blackPlayer);

    [previous, next].forEach(function (button) {
      controls.appendChild(button);
    });

    panel.appendChild(players);
    panel.appendChild(moveList);
    panel.appendChild(controls);
    body.appendChild(boardEl);
    body.appendChild(panel);
    viewer.appendChild(body);
    if (caption) {
      viewer.appendChild(caption);
    }
    pre.replaceWith(viewer);

    useLinearPieceAnimation();

    var board = window.Chessboard(boardId, {
      draggable: false,
      moveSpeed: 320,
      orientation: "white",
      pieceTheme: pieceTheme,
      position: parsed.initialFen
    });

    function setActiveMove() {
      buttons.forEach(function (button, index) {
        var active = index + 1 === ply;
        button.classList.toggle("is-active", active);
        if (active) {
          button.setAttribute("aria-current", "true");
        } else {
          button.removeAttribute("aria-current");
        }
      });
    }

    function goTo(targetPly) {
      var clampedPly = Math.max(0, Math.min(parsed.moves.length, targetPly));
      game = createChess(parsed.initialFen);
      for (var index = 0; index < clampedPly; index += 1) {
        game.move(parsed.moves[index].san, { sloppy: true });
      }
      ply = clampedPly;
      board.position(game.fen());
      previous.disabled = ply === 0;
      next.disabled = ply === parsed.moves.length;
      setActiveMove();
    }

    buttons = renderMoveList(parsed.moves, moveList, goTo, parsed.initialFullMove);

    previous.addEventListener("click", function () {
      goTo(ply - 1);
    });
    next.addEventListener("click", function () {
      goTo(ply + 1);
    });

    bindPlyLinks(viewer, goTo, parsed.moves.length);

    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        board.resize();
      }).observe(boardEl);
    } else {
      window.addEventListener("resize", function () {
        board.resize();
      });
    }

    goTo(0);
  }

  ready(function () {
    Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), renderViewer);
  });
}());
