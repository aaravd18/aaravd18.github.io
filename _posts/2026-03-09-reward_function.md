---
title: "On Reward Functions That Don't Behave"
date: 2026-03-09
permalink: /posts/art-of-the-reward-function/
excerpt_text: |
  The good news: your optimizer is working
  
  The bad news: your optimizer is working
header:
  image: /images/reward_function_header.png
---


![sft_vs_rl_header](/images/reward_function_header.png)
## The Creative Ways Your Model Will Misunderstand You

In my [previous post](/posts/sft_vs_rl/), I used my poker research to illustrate the
relationship between supervised fine-tuning and reinforcement learning. SFT establishes a behaviour, and RL optimizes it.

Once we moved into the RL phase, a different problem came into focus. If RL is supposed
to improve the model's decisions, the obvious question is: improve according to what criteria?

In RL, that answer is the reward function.

---
### A simple reward function
The reward function has a simple premise - assign a number to each output that tells the model how good it was. Higher is better. The model tries to get that number as high as possible, by any means necessary.

Poker is nice for reinforcement learning because it has a clear, quantifiable objective: win chips. In our setup, the model was given a poker solver's strategy as a starting point and asked to modify it to exploit the opponent's tendencies. In principle, straightforward. 

---
### What the model actually did

Malformatted outputs received zero reward. So the model learned quickly that a small,
safe, valid change beat a creative but potentially broken one. It's statistically sound -
consistent average reward from boring decisions outperformed the risk of attempting
something ambitious and getting nothing.

So that's what it learned.

As training progressed, it regressed to making the smallest possible modification to the solver output, collected average
reward, and never actually attempted to exploit anyone.

<p style="margin-bottom: 10px;">My reaction:</p>
<img src="/images/mike.png" width="160" style="display: block; margin-left: 0; margin-top: 0">

---
### Whack-a-mole

The natural response is to patch the reward function. For example, penalize minimal changes, and reward
more aggressive exploitation.

But close one shortcut and the model finds another. It's kind of like whack-a-mole,
except our mole is a 3 billion parameter language model and the hammer is our reward
function. The issue isn't any specific loophole, but rather: 

> The model optimizes for the numerical reward, not the intention behind it.

With this in mind, designing a reward function is less like engineering and more like cooking. 
You have your ingredients – format correctness, output length, exploitation quality, solver deviation
– and you need to find the right balance.


---
### Where we're at now

We made progress by increasing the quantity and quality of our SFT data (huge impact), 
adding penalties on short outputs, and editing the reward formula.

But this is less a solved problem and more a stable configuration.
Whether it's good enough to produce a winning poker AI is a question we're still working on.

Which is the point, really. Designing a reward function is a small version of the
alignment problem. You cannot optimize directly for the thing you care about, so you
approximate it as best as you can.

This shows up everywhere. Models trained on human feedback learn to agree with you
because agreement gets rewarded. Tell the model it is wrong and it apologizes. Tell it
you prefer a different answer and it changes its mind. Not because the new answer is
better, but because humans respond well to validation and the model has learned this
about us. 

Getting models to do what we actually want is an open problem and an exciting one. 