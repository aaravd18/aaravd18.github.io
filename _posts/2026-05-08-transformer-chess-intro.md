---
title: 'Reverse Engineering Chess: Part 1'
date: 2026-05-08
permalink: /posts/transformer-chess/
excerpt_text: What does a neural network actually learn when it learns to play chess?
---
What does a neural network actually learn when it learns to play chess?

Does it develop concepts humans would recognize, like forks or pins? Or does it arrive at strong play through representations that look very different from our own?

In this mini-series, I train a transformer to predict the next move in real chess games, then dissect the network to see what it learned. This is the project of mechanistic interpretability, i.e reverse-engineering neural networks to understand what algorithms their weights actually implement.

Chess is an interesting place to explore this. The model is not explicitly taught tactics, strategy, or even how the pieces move. It only sees board positions and the moves strong players chose next. And yet, if it becomes good at chess, something inside the network must be encoding the abstractions necessary to make strong decisions. And having played the game competitively growing up, I'm especially curious whether the model's internal concepts line up with the ones I learned over the board.

Rather than using an existing architecture, I built the full pipeline from scratch to tailor it for interpretability. This first post focuses on the core design decisions and training that lays the foundation for my interpretability experiments in later posts.

## Architecture
While the strongest chess engines currently use a combination of tree search with neural network evaluations, the transformer is a much more natural fit for interpretability work. The board has 64 squares, so we can represent a position as a fixed-length sequence where each token corresponds to a physical square. This gives attention patterns a direct correspondence to interactions between squares, while each position in the residual stream continues to represent the same square throughout the network. 

My base model is a fairly standard transformer with ~6.5M params: 8 layers, 8 heads, d<sub>model</sub> = 256, d<sub>ffn</sub> = 1024, bidirectional attention. While [Leela](https://arxiv.org/abs/2409.12272) (the SoTA chess transformer) uses post-norm with scaling, I used pre-norm so the residual stream is nice and clean. Leela also uses a much smaller FFN-to-d<sub>model</sub> ratio than is standard, but I kept mine at the conventional 4x. In general I wanted to avoid domain-specific tricks or inductive biases so the focus stays on what a vanilla architecture learns.

## Tokenization
Each board position is converted to a 68-token sequence: 64 square tokens (empty, or one of 12 piece/color combinations), plus a few auxiliary tokens for castling rights, en passant, and the halfmove clock. 

Some interesting work has gone the other direction – feeding move notation into a standard language model and having it predict the next move as text. This forces the model to construct an internal representation of the board from move history before it can reason about it, and [Adam Karvonen showed](https://adamkarvonen.github.io/machine_learning/2024/01/03/chess-world-models.html) that the model actually does exactly this. However, tokenizing the board directly skips that reconstruction step and lets the model spend all its capacity on reasoning about the position itself (which is what I'm interested in seeing). 

I also canonicalize every position to "white to move" by mirroring the board on black-to-play positions, which halves the state space the model has to cover. Features and heads can then specialize to chess concepts instead of learning two mirrored copies of each one.

## Policy Head
The model needs to predict a move, which decomposes naturally into a source square and a target square. Two MLPs operate on the final residual stream — one projects each square's embedding into a "source" representation, the other into a "target" representation. Their dot product gives a 64×64 matrix where entry (i, j) is the logit for moving the piece on square i to square j. Pawn promotions also need an extra choice of piece so a small classifier on the source representation predicts that separately.

The two MLPs share their first layer, which is a small nod to the symmetry that whatever makes a square interesting as a source likely also makes it interesting as a target. The structure follows [Leela's policy head](https://arxiv.org/abs/2409.12272).

## Data
I pulled 50,000 games from the [Lichess open database](https://database.lichess.org/), filtered to games where both players were rated 1800+ (roughly the top 15–20% of players) and the time control gave each player at least three minutes. The filters keep the dataset focused on reasonably strong, deliberate play.

That gave me ~3.75M board positions (≈75 plies per game), split 3.5M train / 0.25M validation.

## Training

The model is trained to predict the move the human played. Training on Stockfish evaluations would yield a stronger model, but maximal playing strength isn't the goal here so strong human moves suffice.

The loss is a flat 4096-way cross-entropy over all (from, to) square pairs. I don't mask out illegal moves at training time so that legal piece movement is represented somewhere in the weights.

I trained for ~14M positions total, roughly four epochs over the training set.

## Initial evaluation

On 20,000 held-out validation positions:

- **Legality:** The model outputs a legal move 99.8% of the time. So the model has learned a baseline understanding of the rules without ever being told them explicitly
- **Accuracy:** Model predicts the human move 49% of the time. The human move is in the modle's top three choices 77.6% of the time and the top five 87.7% of the time.
- **Mate-in-one:** It finds the winning move in 35 of 65 mate-in-one positions, and solves the scholar's mate - a beginner checkmate that wouldn't appear in 1800+ training data. Suggests the model has learned to recognize the pattern rather than memorize it.

It also plays a coherent game. The tactics are weak but the opening repertoire is noticeably stronger, which makes sense since memorizing opening sequences is the easy part for a model. On greedy decoding it answers 1.e4 with the Najdorf (the most common opening) and follows mainline theory for eight moves. With a bit of sampling temperature it played the Sicilian Pelikan against me, which was a fun coincidence given that happened to be my own opening of choice from when I played competitively.

I've posted the full codebase and implementation details on [Github](https://github.com/aaravd18/transformer-chess). The next posts get into the actual intepretability work. I'll cover linear probes on the residual stream, attention head analysis, and activation patching, with the goal of understanding how the model internally represents the concepts of chess. 