import Phaser from 'phaser';
import { ARENA } from '../../config/balance';
import { THEME } from '../../config/theme';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { RunEvents } from '../RunEvents';
import type { Anchor, Fx } from './Fx';

/** The merge key for gold over the slime's head: every kill there adds into one popup. */
const HEAD = 'head';

/**
 * What the player sees when something happens in the run: kill gold, the
 * level-up ring, the stage-clear popups, the hit shake. Pure presentation,
 * driven entirely by the run's events, so gameplay never calls a visual
 * directly for these.
 *
 * Popups over the slime stack by row above its crown: row 0 is kill gold (when it isn't on the mob); the
 * stage-clear heal, the HP bonus, the speed bonus and the mode's clear bonus
 * sit on rows 1–4, so the kill that clears a stage never hides them.
 */
export class RunFeedback {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fx: Fx,
    private readonly player: Player,
    events: RunEvents,
  ) {
    // League's last-hit gold: what this kill was worth, on the mob or riding on the slime's head.
    events.on('kill', ({ target, points }) => {
      if (THEME.killGold.onMob) this.fx.goldPopup(this.onMob(target), points, target);
      else this.fx.goldPopup(() => ({ x: this.player.x, y: this.overHead(0) }), points, HEAD);
    });

    events.on('levelUp', ({ level }) => {
      const { x, y, radius } = this.player;
      this.fx.ring(x, y, radius + 4, radius + 46, 420, THEME.ui.accent, 1, 6);
      this.fx.popup(x, this.overHead(0) - 6, `LEVEL ${level}`, THEME.ui.accent, 900, 30);
    });

    events.on('markDetonated', ({ target }) => this.fx.detonation(target.x, target.y));

    // A kit's award earned on a mob shows there with the kill gold, adding into it when that mob just died.
    events.on('kitBonus', ({ points, from }) => {
      if (from && THEME.killGold.onMob) this.fx.goldPopup(this.onMob(from), points, from);
      else this.scorePopup(`+${points}`, 1);
    });

    events.on('waveCleared', ({ points }) => {
      if (points > 0) this.scorePopup(`+${points} SPEED`, 3);
    });

    events.on('stageCleared', ({ points, bonus, flawless, healed }) => {
      if (points > 0) this.scorePopup(`+${points} ${flawless ? 'FLAWLESS' : 'HP'}`, 2);
      if (bonus > 0) this.scorePopup(`+${bonus} CLEAR`, 4);
      // Damage is scaled, so HP can be fractional; the HUD shows it rounded up, so the
      // heal shows rounded down: exactly the jump the HP readout makes.
      const shown = Math.floor(healed);
      if (shown > 0) this.fx.popup(this.player.x, this.overHead(1), `+${shown}`, THEME.ui.good, 800, 26);
    });

    // A hit registers even when your eyes are on the enemy: a shake and a red rim flash.
    events.on('playerHit', () => {
      this.scene.cameras.main.shake(90, 0.004);
      const rim = this.scene.add
        .rectangle(ARENA.width / 2, ARENA.height / 2, ARENA.width - 8, ARENA.height - 8, 0x000000, 0)
        .setStrokeStyle(8, THEME.ui.hitRim, 0.55)
        .setDepth(THEME.depth.screen);
      this.scene.tweens.add({ targets: rim, alpha: 0, duration: 260, onComplete: () => rim.destroy() });
    });
  }

  /**
   * Where gold on a mob rises from, fixed where it was earned: a dead mob's in
   * place of its killing "-1" (EnemyView.onHit), a live one's just above the "-1" it still shows.
   */
  private onMob(target: Enemy): Anchor {
    const at = { x: target.x, y: target.y - target.radius - 6 - (target.dead ? 0 : 18) };
    return () => at;
  }

  /** Where text over the slime starts: just above the crown, `row` popup rows up. */
  private overHead(row: number): number {
    return this.player.y - this.player.radius - 18 - this.player.headPx - row * 24;
  }

  private scorePopup(text: string, row: number): void {
    this.fx.popup(this.player.x, this.overHead(row), text, THEME.ui.accent, 1100, 26);
  }
}
