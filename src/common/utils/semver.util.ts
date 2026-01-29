/**
 * Utility class for semantic version parsing and comparison.
 */
export class SemVer {
  constructor(
    public readonly major: number,
    public readonly minor: number,
    public readonly patch: number,
    public readonly prerelease?: string,
    public readonly build?: string,
  ) {}

  /**
   * Parse a semantic version string.
   */
  static parse(version: string): SemVer {
    const match = version.match(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
    );

    if (!match) {
      throw new Error(`Invalid semantic version: ${version}`);
    }

    return new SemVer(
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      match[4],
      match[5],
    );
  }

  /**
   * Compare this version to another.
   * Returns -1 if this < other, 0 if equal, 1 if this > other.
   */
  compareTo(other: SemVer): number {
    if (this.major !== other.major) {
      return this.major > other.major ? 1 : -1;
    }
    if (this.minor !== other.minor) {
      return this.minor > other.minor ? 1 : -1;
    }
    if (this.patch !== other.patch) {
      return this.patch > other.patch ? 1 : -1;
    }

    // Prerelease comparison
    if (this.prerelease && !other.prerelease) {
      return -1;
    }
    if (!this.prerelease && other.prerelease) {
      return 1;
    }
    if (this.prerelease && other.prerelease) {
      const prereleaseCompare = this.prerelease.localeCompare(other.prerelease);
      if (prereleaseCompare !== 0) {
        return prereleaseCompare;
      }
    }

    return 0;
  }

  /**
   * Check if this version is compatible with the given minimum version.
   */
  isCompatibleWith(minVersion: SemVer): boolean {
    return this.compareTo(minVersion) >= 0;
  }

  toString(): string {
    let result = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease) {
      result += `-${this.prerelease}`;
    }
    if (this.build) {
      result += `+${this.build}`;
    }
    return result;
  }
}
