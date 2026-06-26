"""Constellan backend adapters.

The flagship adapters (``RealHydraAdapter`` for HydraDB and ``DemoHydraAdapter``)
live in ``hydra_client``. This package adds the zero-setup ``LocalGraphAdapter``,
which builds a transparent local heuristic relation graph in-process so anyone
can run the full pipeline on their own data with no HydraDB key, account, or
network. HydraDB remains the flagship, graph-native backend; the local adapter
is an additive, honestly-labelled convenience for instant trial.
"""
from __future__ import annotations

from .local_adapter import LOCAL_GRAPH_SOURCE, LocalGraphAdapter

__all__ = ["LocalGraphAdapter", "LOCAL_GRAPH_SOURCE"]
