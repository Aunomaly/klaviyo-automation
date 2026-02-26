"""
Brand extraction modules
"""
import sys
import os

# Handle both module and direct execution
if 'scraper.extractors' in sys.modules or __package__:
    from .colors import ColorExtractor
    from .fonts import FontExtractor
    from .images import ImageExtractor
else:
    # Direct execution - use absolute imports
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from colors import ColorExtractor
    from fonts import FontExtractor
    from images import ImageExtractor

__all__ = ['ColorExtractor', 'FontExtractor', 'ImageExtractor']
