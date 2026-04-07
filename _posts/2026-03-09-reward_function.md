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

## The Creative Ways Your Model Will Misunderstand You
![sft_vs_rl_header](/images/reward_function_header.png)

In my [previous post](/posts/sft_vs_rl/), I used my poker research project to illustrate the relationship between supervised fine-tuning (SFT) and reinforcement learning (RL). SFT establishes the behavior space, and RL optimizes within that space.

Once we moved into the RL phase of the project, though, a different challenge came into focus. If reinforcement learning is supposed to improve the model’s decisions, the logical question is: improve according to what criteria?

In RL, that answer is the reward function.

At first glance this part seemed straightforward for us. Poker has a clear objective - win chips. In our setup, the reward signal ultimately came from chip gain measured by the solver. In principle, that should provide a clean signal about whether a strategy adjustment improves performance.

But the interaction between the model and the solver made things more complicated.

By the time we began reinforcement learning, the model had already gone through SFT. During that stage we trained it to produce strategies in a strict format that the poker solver could interpret.

Supervised training worked well for this. The model learned the structure of the outputs and could reliably produce solver-compatible strategies.

The difficulty appeared once RL began. Now the model had two goals at once. It needed to modify strategies in ways that improved chip gain, but it also needed to stay within the formatting rules it had learned during SFT.

Whenever the format drifted, the solver simply couldn’t run. If the solver couldn’t evaluate the strategy, there was no chip result and therefore no reward.

Early in training this happened often. While exploring different strategies, the model would occasionally break the format constraints, which meant the output could not be evaluated at all. Many attempts therefore looked identical from the model’s perspective, because they all produced zero reward.

When the feedback signal collapses like this, learning becomes difficult. The model cannot easily tell whether one attempt was closer to the objective than another.

A natural response is to make the reward signal more forgiving. Instead of rewarding only perfectly valid outputs, you can introduce intermediate signals that reward partial progress.

But doing this introduces its own trade-offs.

Optimization systems tend to take the most direct path to reward. If there is a way to collect reward without genuinely improving the behavior you care about, the model will eventually discover it.

In our case the goal was to generate strategies that actually exploited an opponent. But if the reward became too loosely defined, the model could drift toward outputs that satisfied parts of the reward signal while still being strategically weak. The system was still optimizing the reward, just not in the way we wanted it to. 

Designing a reward function ends up being an exercise in balancing these pressures. If the reward is too strict, the learning signal becomes sparse and the model struggles to improve. If it becomes too forgiving, the model may settle into shortcuts that maximize reward without improving the underlying behavior.

Somewhere between those two extremes is a reward signal that provides enough guidance for the model to learn while still reflecting the real objective closely enough. And finding that balance rarely happens on the first attempt.

In practice the process becomes iterative. You define a reward signal, train the model, observe the behavior it learns, and then refine the reward to correct whatever unintended incentives appear.

Each iteration reveals another edge case. In that sense the model acts almost like a stress test for your objective: by pushing the reward signal as hard as possible, it exposes where the signal fails to capture what you actually want.

Working on this project made something clear to me. Designing a reward function is really a small version of the broader alignment problem in AI.

In most real systems we cannot optimize directly for the thing we care about. Instead we define measurable proxies and hope they capture the objective well enough. The difficulty is that optimization systems treat those proxies literally.

> They optimize the signal you specify, not the intention behind it.

Even in a relatively contained setting like poker, translating a simple objective (win chips) into a reward signal that reliably guides learning turns out to be more subtle than it first appears. And in real-world settings, where the objective is often less clear-cut, the care required in designing that signal only increases.
