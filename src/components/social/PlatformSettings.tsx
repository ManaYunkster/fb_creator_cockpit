// components/social/PlatformSettings.tsx
import React from 'react';
import { VENUE_LENGTH_CONFIG } from '../../config/social_post_config';

interface PlatformSettingsProps {
  venue: string;
  setVenue: (venue: string) => void;
  postLength: string;
  setPostLength: (postLength: string) => void;
}

const PlatformSettings: React.FC<PlatformSettingsProps> = ({
  venue,
  setVenue,
  postLength,
  setPostLength,
}) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">Step 3: Choose Platform & Post Length</label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="venue" className="block text-xs font-medium text-gray-400 mb-1">Platform & Venue</label>
          <select id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200">
            <option value="Substack Notes">Substack Notes</option>
            <option value="LinkedIn (Personal Feed)">LinkedIn (Personal Feed)</option>
            <option value="LinkedIn (The Do Good by Doing Better Page)">LinkedIn (The Do Good by Doing Better Page)</option>
            <option value="BlueSky (Personal Feed)">BlueSky (Personal Feed)</option>
          </select>
        </div>
        <div>
          <label htmlFor="post-length" className="block text-xs font-medium text-gray-400 mb-1">Post Length</label>
          <select id="post-length" value={postLength} onChange={(e) => setPostLength(e.target.value)} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200">
            {VENUE_LENGTH_CONFIG[venue]?.options.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default PlatformSettings;
