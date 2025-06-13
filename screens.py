#!/usr/bin/env python3
"""
Pete & Pete Screenshot Distribution Analyzer
Analyzes screenshot distribution across episodes to identify underrepresented content.
"""

import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, List, Tuple

@dataclass
class EpisodeInfo:
    season: Optional[int] = None
    episode: Optional[int] = None
    episode_id: Optional[str] = None
    title: Optional[str] = None
    is_special: bool = False

def extract_episode_info(filename: str) -> EpisodeInfo:
    """Extract episode information from filename using same logic as the bot."""
    # Remove file extension and clean up
    clean_name = re.sub(r'\.(jpg|jpeg|png|gif|bmp)$', '', filename, flags=re.IGNORECASE)
    clean_name = re.sub(r'[_\-]+', ' ', clean_name)
    clean_name = re.sub(r'\s+', ' ', clean_name).strip()
    
    # Try to extract season and episode info
    season_episode_patterns = [
        r'(?:Season?\s*)?(\d+)x(\d+)',           # 1x05, Season 1x05
        r'S(\d+)E(\d+)',                         # S01E08
        r'Season\s*(\d+)\s*Episode\s*(\d+)',     # Season 1 Episode 5
        r'(\d+)\s*x\s*(\d+)'                     # 3 x 12
    ]
    
    season = episode = None
    for pattern in season_episode_patterns:
        match = re.search(pattern, clean_name, re.IGNORECASE)
        if match:
            season = int(match.group(1))
            episode = int(match.group(2))
            break
    
    # Try to extract episode title
    episode_title = None
    if season is not None and episode is not None:
        # Look for title after season/episode info
        title_patterns = [
            rf'(?:Season?\s*)?{season}\s*x\s*{episode}\s*[\-_]?\s*(.+?)(?:\s*\-?\s*\d+)?$',
            rf'S{season:02d}E{episode:02d}\s*[\-_]?\s*(.+?)(?:\s*\-?\s*\d+)?$',
            rf'{season}\s*x\s*{episode}\s*[\-_]?\s*(.+?)(?:\s*\-?\s*\d+)?$'
        ]
        
        for pattern in title_patterns:
            match = re.search(pattern, clean_name, re.IGNORECASE)
            if match and match.group(1):
                episode_title = match.group(1).strip()
                break
    else:
        # Try general title patterns
        general_patterns = [
            r'The Adventures of Pete\s*&?\s*Pete\s*[\-_]?\s*(.+?)(?:\s*\-?\s*\d+)?$',
            r'Pete\s*&?\s*Pete\s*[\-_]?\s*(.+?)(?:\s*\-?\s*\d+)?$',
            r'^(.+?)(?:\s*\-?\s*\d+)?$'  # Fallback
        ]
        
        for pattern in general_patterns:
            match = re.search(pattern, clean_name, re.IGNORECASE)
            if match and match.group(1) and len(match.group(1).strip()) > 0:
                episode_title = match.group(1).strip()
                break
    
    # Clean up episode title
    if episode_title:
        episode_title = re.sub(r'^[\-_\s]+|[\-_\s]+$', '', episode_title)
        episode_title = re.sub(r'[_]+', ' ', episode_title)
        episode_title = re.sub(r'\s+', ' ', episode_title).strip()
        
        # Fix common formatting issues
        episode_title = re.sub(r'\b([a-z])\s+([smldt])\b', r"\1'\2", episode_title, flags=re.IGNORECASE)
        episode_title = re.sub(r'\bpete\b', 'Pete', episode_title, flags=re.IGNORECASE)
        episode_title = re.sub(r'\band\b', 'and', episode_title, flags=re.IGNORECASE)
        episode_title = re.sub(r'\bthe\b', 'the', episode_title, flags=re.IGNORECASE)
        
        # Title case
        small_words = {'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'of', 'on', 'or', 'the', 'to', 'up'}
        words = episode_title.split()
        for i, word in enumerate(words):
            if i == 0 or word.lower() not in small_words:
                words[i] = word.capitalize()
            else:
                words[i] = word.lower()
        episode_title = ' '.join(words)
    
    episode_id = f"S{season}E{episode}" if season is not None and episode is not None else None
    
    return EpisodeInfo(
        season=season,
        episode=episode,
        episode_id=episode_id,
        title=episode_title,
        is_special=(season == 0)
    )

def is_image_file(filename: str) -> bool:
    """Check if file is a supported image format."""
    return bool(re.search(r'\.(jpg|jpeg|png|gif|bmp)$', filename, re.IGNORECASE))

def analyze_distribution(imagequeue_path: str) -> None:
    """Analyze and report episode distribution."""
    print("🎬 Pete & Pete Screenshot Distribution Analyzer\n")
    
    path = Path(imagequeue_path)
    if not path.exists():
        print(f"❌ Directory not found: {imagequeue_path}")
        sys.exit(1)
    
    # Get all image files
    image_files = [f.name for f in path.iterdir() if f.is_file() and is_image_file(f.name)]
    
    if not image_files:
        print(f"❌ No image files found in {imagequeue_path}")
        sys.exit(1)
    
    print(f"📁 Found {len(image_files)} image files\n")
    
    # Group by episode
    episodes = defaultdict(list)
    unidentified = []
    
    for filename in image_files:
        episode_info = extract_episode_info(filename)
        
        if not episode_info.episode_id and not episode_info.title:
            unidentified.append(filename)
            continue
        
        key = episode_info.episode_id or f"Unknown-{episode_info.title or 'Untitled'}"
        episodes[key].append((filename, episode_info))
    
    # Calculate stats
    episode_counts = {key: len(files) for key, files in episodes.items()}
    total_images = sum(episode_counts.values())
    avg_per_episode = total_images / len(episodes) if episodes else 0
    
    print("📊 EPISODE DISTRIBUTION REPORT")
    print("=" * 50)
    print(f"Total Episodes: {len(episodes)}")
    print(f"Total Images: {total_images}")
    print(f"Average per Episode: {avg_per_episode:.1f}")
    print(f"Range: {min(episode_counts.values())} - {max(episode_counts.values())} images per episode\n")
    
    # Sort episodes for display
    def sort_key(item):
        key, files = item
        episode_info = files[0][1]  # Get episode info from first file
        
        # Handle specials (Season 0)
        if episode_info.season == 0:
            return (1, 0, 0, key)  # Sort specials last
        
        # Handle episodes without season/episode numbers
        if episode_info.season is None:
            return (2, 0, 0, key)  # Sort unknowns after specials
        
        # Normal episodes
        return (0, episode_info.season or 0, episode_info.episode or 0, key)
    
    sorted_episodes = sorted(episodes.items(), key=sort_key)
    
    # Display all episodes
    print("📋 EPISODE BREAKDOWN:")
    print("-" * 80)
    
    for key, files in sorted_episodes:
        count = len(files)
        percentage = (count / total_images) * 100
        episode_info = files[0][1]
        
        if episode_info.episode_id:
            if episode_info.is_special:
                display = f"Special: {episode_info.title or 'Unknown Title'}"
            else:
                display = episode_info.episode_id
                if episode_info.title:
                    display += f": {episode_info.title}"
        else:
            display = episode_info.title or "Unknown"
        
        print(f"{count:3d} ({percentage:4.1f}%) - {display}")
    
    # Identify underrepresented episodes
    threshold = int(avg_per_episode * 0.75)
    underrepresented = [(key, files) for key, files in sorted_episodes 
                       if len(files) < threshold]
    
    if underrepresented:
        print(f"\n🎯 UNDERREPRESENTED EPISODES (need more screenshots):")
        print("-" * 80)
        print(f"(Episodes with fewer than {threshold} images)\n")
        
        for key, files in underrepresented:
            count = len(files)
            needed = threshold - count
            episode_info = files[0][1]
            
            if episode_info.episode_id:
                if episode_info.is_special:
                    display = f"Special: {episode_info.title or 'Unknown Title'}"
                else:
                    display = episode_info.episode_id
                    if episode_info.title:
                        display += f": {episode_info.title}"
            else:
                display = episode_info.title or "Unknown"
            
            print(f"{count:3d} images (need {needed:2d} more) - {display}")
    
    # Show unidentified files
    if unidentified:
        print(f"\n❓ UNIDENTIFIED FILES:")
        print("-" * 50)
        print(f"{len(unidentified)} files could not be parsed for episode info:\n")
        
        for filename in unidentified[:10]:  # Show first 10
            print(f"  • {filename}")
        
        if len(unidentified) > 10:
            print(f"  ... and {len(unidentified) - 10} more")
    
    # Top and bottom episodes
    sorted_by_count = sorted(episodes.items(), key=lambda x: len(x[1]), reverse=True)
    
    print("\n🏆 TOP 5 EPISODES (most screenshots):")
    print("-" * 50)
    for key, files in sorted_by_count[:5]:
        count = len(files)
        episode_info = files[0][1]
        display = episode_info.episode_id or episode_info.title or "Unknown"
        if episode_info.episode_id and episode_info.title:
            display = f"{episode_info.episode_id}: {episode_info.title}"
        print(f"  {count:3d} - {display}")
    
    print("\n📉 BOTTOM 5 EPISODES (fewest screenshots):")
    print("-" * 50)
    for key, files in sorted_by_count[-5:]:
        count = len(files)
        episode_info = files[0][1]
        display = episode_info.episode_id or episode_info.title or "Unknown"
        if episode_info.episode_id and episode_info.title:
            display = f"{episode_info.episode_id}: {episode_info.title}"
        print(f"  {count:3d} - {display}")
    
    print("\n✨ Analysis complete! Use this data to balance your screenshot collection.")

def main():
    """Main function."""
    imagequeue_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.getcwd(), 'imagequeue')
    
    try:
        analyze_distribution(imagequeue_path)
    except Exception as e:
        print(f"❌ Error analyzing episodes: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
