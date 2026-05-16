---
title: 'Reverse Engineering Chess: Part 1'
date: 2026-05-08
permalink: /posts/transformer-chess/
excerpt_text: What does a neural network actually learn when it learns to play chess?
chess_viewer: true
---
What does a neural network actually learn when it learns to play chess?

Does it develop concepts humans would recognize, like forks or pins? Or does it arrive at strong play through representations that look very different from our own?

In this mini-series, I train a transformer to predict the next move in real chess games, then dissect the network to see what it learned. This is the project of mechanistic interpretability, i.e reverse-engineering neural networks to understand what algorithms their weights actually implement.

<figure class="image-with-caption" style="--image-caption-width: 480px;">
  <img src="/images/ruy-lopez-teaser.png" alt="">
  <figcaption class="image-caption">A peek inside: In a Ruy Lopez position, one attention head focuses the bishop along its pinning diagonal.</figcaption>
</figure>


The model is not explicitly taught tactics, strategy, or even how the pieces move. It only sees board positions and the moves strong players chose next. And yet, to play well, something inside the network must be encoding the abstractions needed to understand the game. The image above is one small glimpse of that understanding.

Rather than using an existing architecture, I built the full pipeline from scratch to tailor it for interpretability. This first post focuses on the core design decisions and training that lays the foundation for my interpretability experiments in later posts. There's also an annotated game at the end showing how the trained model plays.

## Architecture
While the strongest chess engines currently use a combination of tree search with neural network evaluations, the transformer is a much more natural fit for interpretability work. The board has 64 squares, so we can represent a position as a fixed-length sequence where each token corresponds to a physical square. This gives attention patterns a direct correspondence to interactions between squares, while each position in the residual stream continues to represent the same square throughout the network. 

My base model is a fairly standard transformer with ~6.5M params: 8 layers, 8 heads, d<sub>model</sub> = 256, d<sub>ffn</sub> = 1024, bidirectional attention. While [Leela](https://arxiv.org/abs/2409.12272) (the SoTA chess transformer) uses post-norm with scaling, I used pre-norm to preserve a cleaner additive residual stream, which makes attention-head and MLP contributions easier to isolate. Leela also uses a much smaller FFN-to-d<sub>model</sub> ratio than is standard, but I kept mine at the conventional 4x. In general I wanted to avoid domain-specific tricks or inductive biases so the focus stays on what a vanilla architecture learns.

## Tokenization
Each board position is converted to a 68-token sequence: 64 square tokens (empty, or one of 12 piece/color combinations), plus a few auxiliary tokens for castling rights, en passant, and the halfmove clock. 

Some interesting work has gone the other direction – feeding move notation into a standard language model and having it predict the next move as text. This forces the model to construct an internal representation of the board from move history before it can reason about it, and [Adam Karvonen showed](https://adamkarvonen.github.io/machine_learning/2024/01/03/chess-world-models.html) that the model actually does this. However, tokenizing the board skips that reconstruction step and lets the model spend all its capacity on reasoning about the position itself. Since a chess position is fully determined by the current board state, its evaluation should not depend on the moves that were played to reach it, making direct board tokenization a more natural representation for position evaluation.

I also canonicalize every position to "white to move" by mirroring the board on black-to-play positions, which halves the state space the model has to cover. Features and heads can then specialize to chess concepts instead of learning two mirrored copies of each one.

## Policy Head
The model needs to predict a move, which decomposes naturally into a source square and a target square. Two MLPs operate on the final residual stream – one projects each square's embedding into a "source" representation, the other into a "target" representation. Their dot product gives a 64×64 matrix where entry (i, j) is the logit for moving the piece on square i to square j. Pawn promotions also need an extra choice of piece so a small classifier on the source representation predicts that separately.

The two MLPs share their first layer, with the idea that whatever makes a square interesting as a source likely also makes it interesting as a target. The structure follows [Leela's policy head](https://arxiv.org/abs/2409.12272).

## Data
I pulled 50,000 games from the [Lichess open database](https://database.lichess.org/), filtered to games where both players were rated 1800+ (roughly the top 15–20% of players) and the time control gave each player at least three minutes. The filters keep the dataset focused on strong, deliberate play.

That gave me ~3.75M board positions (≈75 plies per game), split 3.5M train / 0.25M validation.

## Training

The model is trained to predict the move the human played. Training on Stockfish evaluations would yield a stronger model, but maximal playing strength isn't the goal here so strong human moves suffice.

The loss is a flat 4096-way cross-entropy over all (from, to) square pairs. I don't mask out illegal moves at training time so that legal piece movement is learned and represented somewhere in the weights.

I trained for ~14M positions total, roughly four epochs over the training set. Thanks to a relatively small architecture and an optimized training pipeline, validation loss plateaued after only about an hour of training on a single L4 GPU.

## Initial Evaluation

In evaluation games against a Stockfish engine set to 1450 Elo, it scored approximately 50% over a 100-game match. This rating should be interpreted loosely since Stockfish’s weakened play is not very human-like.

On 20,000 held-out validation positions:

- **Legality:** The model outputs a legal move 99.8% of the time. Meaning it has learned a baseline understanding of the rules without ever being told them explicitly.
- **Accuracy:** Model predicts the human move 49% of the time. The human move is in the model's top three choices 77.6% of the time and in the top five 87.7% of the time.

In testing, the model consistently followed main-line theory in any opening it faced. Its opening repertoire and positional play is noticeably stronger than what a typical human at this playing level would possess. At the same time, it is prone to simple blunders that would look unusual for any human of comparable strength, giving the model a somewhat uneven but very interesting playing style.

Importantly, this is close to the capability level we want for interpretability work. The model is strong enough to internalize meaningful chess concepts, and simple enough that we may be able to isolate and understand the mechanisms behind its decisions.

Here's one illustrative game against Stockfish at a weakened setting. The model seizes the center with principled offensive chess, and shows some nice tactical reasoning to dismantle an opponent whose play, quite fittingly, resembles a bot's:

```pgn
[Date "2026.05.08"]
[Round "?"]
[White "Chess Transformer"]
[Black "Crappy Stockfish"]
[Result "1-0"]

1. e4 Nc6 2. d4 e5 3. d5 Nb4 4. a3 Na6 5. c4 Nb8 6. Nc3 h6 7. f4 exf4 8. Bxf4 Bc5 9. Nf3 d6 10. Bd3 Bg4 11. b4 Bd4 12. Rc1 Nf6 13. h3 Bxf3 14. Qxf3 a5 15. Nb5 Bb2 16. Rc2 Bxa3 17. Nxa3 g5 18. Bh2 g4 19. hxg4 Rg8 20. O-O h5 21. Qxf6 Qxf6 22. Rxf6 axb4 23. Nb5 Nd7 24. Nxc7+ Kd8 25. Nxa8 Nxf6 26. Bxd6 b3 27. Rb2 Kd7 28. Be5 Nxg4 29. Nb6+ Ke7 30. Bd4 Re8 31. Rxb3 Rd8 32. c5 f6 33. c6 Kf7 34. c7 Rd6 35. c8=Q h4 36. Qxb7+ Kf8 37. Bc5 f5 38. Bxd6+ Kg8 39. exf5 Nf6 40. Qc8+ Kh7 41. Qc7+ Kh8 42. Be5 Kg8 43. Bxf6 Kf8 44. Qe7+ Kg8 45. Qg7# 1-0
```

An interesting sequence starts after [27... Kd7](#ply-54) as both white's bishop and knight are under attack. There model manages to save both, starting with [28. Be5](#ply-55), saving the bishop while attacking Black's knight (so Rxa8 would be met with Bxf6). After [28... Nxg4](#ply-56), both pieces are under attack again, so the model continues with [29. Nb6+](#ply-57), escaping with check to evacuate the bishop the next move. Exactly the kind of sophisticated thinking that will make the model interesting to dissect.
{: .chess-viewer-caption}

## What's Next

I've posted the full codebase and implementation details on [Github](https://github.com/aaravd18/transformer-chess). The next phase of the project is understanding how our trained model actually reasons about chess. In the next post, I’ll use some classic mechanistic interpretability techniques to open the model up and explore its internal representations of the game.
