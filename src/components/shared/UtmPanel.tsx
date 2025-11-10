// components/shared/UtmPanel.tsx
import React, { useState, useEffect } from 'react';
import ChevronDownIcon from '../icons/ChevronDownIcon';
import { VENUE_UTM_CONFIG } from '../../config/social_post_config';
import { Post } from '../../types';

interface UtmPanelProps {
  url: string;
  venue: string;
  useCustomUrl: boolean;
  availablePosts: Post[];
  appendUtmTags: boolean;
  setAppendUtmTags: (value: boolean) => void;
  utmSource: string;
  setUtmSource: (value: string) => void;
  utmMedium: string;
  setUtmMedium: (value: string) => void;
  utmCampaign: string;
  setUtmCampaign: (value: string) => void;
  utmTerm: string;
  setUtmTerm: (value: string) => void;
  utmContent: string;
  setUtmContent: (value: string) => void;
  suppressWelcomePopup: boolean;
  setSuppressWelcomePopup: (value: boolean) => void;
}

const UtmPanel: React.FC<UtmPanelProps> = ({
  url,
  venue,
  useCustomUrl,
  availablePosts,
  appendUtmTags,
  setAppendUtmTags,
  utmSource,
  setUtmSource,
  utmMedium,
  setUtmMedium,
  utmCampaign,
  setUtmCampaign,
  utmTerm,
  setUtmTerm,
  utmContent,
  setUtmContent,
  suppressWelcomePopup,
  setSuppressWelcomePopup,
}) => {
  const [isUtmPanelOpen, setIsUtmPanelOpen] = useState(false);

  const slugify = (text: string) => {
    if (!text) return '';
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
  };

  useEffect(() => {
    const utmConfig = VENUE_UTM_CONFIG[venue];
    if (!utmConfig) return;

    setUtmSource(utmConfig.source);
    setUtmMedium(utmConfig.medium);
    setUtmTerm(utmConfig.term || '');
    setUtmContent(utmConfig.content || '');
    setSuppressWelcomePopup(utmConfig.showWelcomeOnShare);

    const matchingPost = availablePosts.find(p => p.post_url === url);
    if (utmConfig.campaign) {
        setUtmCampaign(utmConfig.campaign);
    } else if (!useCustomUrl && matchingPost) {
        setUtmCampaign(slugify(matchingPost.title));
    } else {
        setUtmCampaign(utmConfig.defaultCampaignForCustomUrl);
    }
  }, [venue, url, useCustomUrl, availablePosts, setUtmSource, setUtmMedium, setUtmCampaign, setUtmTerm, setUtmContent, setSuppressWelcomePopup]);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setIsUtmPanelOpen(prev => !prev)}>
        <div className="flex items-center">
          <input
            type="checkbox" id="append-utm-toggle" checked={appendUtmTags}
            onChange={(e) => setAppendUtmTags(e.target.checked)}
            onClick={e => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="append-utm-toggle" className="ml-2 text-sm font-medium text-gray-200 cursor-pointer">Append UTM Tags to Link</label>
        </div>
        <button
          aria-expanded={isUtmPanelOpen}
          aria-controls="utm-panel"
          className="p-1 text-gray-400 hover:text-white"
          title={isUtmPanelOpen ? "Collapse" : "Expand"}
        >
          <ChevronDownIcon className={`w-5 h-5 transition-transform ${isUtmPanelOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {isUtmPanelOpen && (
        <div id="utm-panel" className="p-4 border-t border-gray-700 space-y-3 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <label htmlFor="utm-source" className="block text-xs text-gray-400 mb-1">Source (utm_source)</label>
              <input type="text" id="utm-source" value={utmSource} onChange={e => setUtmSource(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200"/>
            </div>
            <div>
              <label htmlFor="utm-medium" className="block text-xs text-gray-400 mb-1">Medium (utm_medium)</label>
              <input type="text" id="utm-medium" value={utmMedium} onChange={e => setUtmMedium(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200"/>
            </div>
          </div>
          <div>
            <label htmlFor="utm-campaign" className="block text-xs text-gray-400 mb-1">Campaign (utm_campaign)</label>
            <input type="text" id="utm-campaign" value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <label htmlFor="utm-term" className="block text-xs text-gray-400 mb-1">Term (utm_term)</label>
              <input type="text" id="utm-term" value={utmTerm} onChange={e => setUtmTerm(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200"/>
            </div>
            <div>
              <label htmlFor="utm-content" className="block text-xs text-gray-400 mb-1">Content (utm_content)</label>
              <input type="text" id="utm-content" value={utmContent} onChange={e => setUtmContent(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200"/>
            </div>
          </div>
          <div className="pt-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="suppress-welcome-toggle"
                checked={suppressWelcomePopup}
                onChange={(e) => setSuppressWelcomePopup(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="suppress-welcome-toggle" className="ml-2 text-sm text-gray-300">
                Suppress Substack 'Welcome' popup
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UtmPanel;
