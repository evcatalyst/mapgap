# loaders.gl companion security patch

Base: `visgl/loaders.gl@f7a4b32712ce176f82b1423f3a3d2453e31b80b6`.

`0001-thrift-0.23.patch` upgrades the Parquet loader from Thrift `^0.19.0`
to `^0.23.0`, clearing both current high-severity Thrift advisories.

Verification on 2026-07-11:

- Parquet Node suite: 82 passed, 4 skipped, 0 failed.
- The first sandboxed run could not fetch the test WASM from unpkg; the
  network-enabled rerun passed.
- Kepler's 11,386-test Node suite also passed with Thrift 0.23 resolved.
