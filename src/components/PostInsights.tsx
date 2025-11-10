import React, { useContext, useState, useMemo } from 'react';
import { DataContext } from '../contexts/DataContext';
import { Post } from '../types';

type SortKey = keyof Post;
type SortOrder = 'asc' | 'desc';

const StatCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</h4>
        <p className="text-3xl font-bold text-gray-100 mt-2">{value}</p>
    </div>
);

const PostInsights: React.FC = () => {
    const { posts } = useContext(DataContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('post_date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    const insights = useMemo(() => {
        if (posts.length === 0) {
            return { 
                totalPosts: 0, totalWords: 0, averageWordCount: 0, 
                // FIX: Explicitly typed postTypeCounts to ensure correct type inference for insights object.
                postTypeCounts: {} as Record<string, number>, totalOpens: 0, totalDeliveries: 0, 
                averageOpensPerPost: 0
            };
        }
        
        const totalPosts = posts.length;
        const totalWords = posts.reduce((sum, post) => sum + (post.word_count || 0), 0);
        const totalOpens = posts.reduce((sum, post) => sum + (post.total_opens || 0), 0);
        const totalDeliveries = posts.reduce((sum, post) => sum + (post.total_deliveries || 0), 0);
        
        const averageWordCount = totalPosts > 0 ? Math.round(totalWords / totalPosts) : 0;
        const averageOpensPerPost = totalPosts > 0 ? Math.round(totalOpens / totalPosts) : 0;
        
        const postTypeCounts = posts.reduce((acc, post) => {
            const type = post.type || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return { 
            totalPosts, totalWords, averageWordCount, postTypeCounts,
            totalOpens, totalDeliveries, averageOpensPerPost
        };
    }, [posts]);

    const sortedAndFilteredPosts = useMemo(() => {
        let filtered = posts.filter(post => 
            post.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            post.subtitle?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (sortKey) {
            filtered.sort((a, b) => {
                const aValue = a[sortKey];
                const bValue = b[sortKey];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                
                if (sortKey === 'post_date') {
                    const dateA = new Date(aValue as string).getTime();
                    const dateB = new Date(bValue as string).getTime();
                    if (dateA < dateB) return sortOrder === 'asc' ? -1 : 1;
                    if (dateA > dateB) return sortOrder === 'asc' ? 1 : -1;
                    return 0;
                }

                if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }, [posts, searchTerm, sortKey, sortOrder]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('desc');
        }
    };
    
    const SortArrow = ({ columnKey }: { columnKey: SortKey }) => {
      if (sortKey !== columnKey) return null;
      return <span>{sortOrder === 'desc' ? ' ↓' : ' ↑'}</span>;
    };

    if (posts.length === 0) {
        return (
            <div className="text-center text-gray-400 p-8 bg-gray-700/50 rounded-lg animate-fade-in">
                <h3 className="text-xl font-semibold text-white mb-4">No Post Data Found</h3>
                <p>Please go to the "Content Corpus" tool to upload your Substack export .zip file.</p>
            </div>
        );
    }
    
    const postTypeColors: Record<string, string> = {
        post: 'bg-blue-500',
        newsletter: 'bg-blue-500',
        thread: 'bg-sky-500',
        podcast: 'bg-purple-500',
        restack: 'bg-indigo-500',
        adhoc_email: 'bg-pink-500',
        unknown: 'bg-gray-500',
    };
    
    const maxTypeCount = Math.max(...Object.values(insights.postTypeCounts), 0);


    return (
        <div className="animate-fade-in-up space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 lg:col-span-2">
                    <StatCard title="Total Posts" value={insights.totalPosts.toLocaleString()} />
                    <StatCard title="Total Words" value={insights.totalWords.toLocaleString()} />
                    <StatCard title="Avg. Words" value={insights.averageWordCount.toLocaleString()} />
                    <StatCard title="Total Opens" value={insights.totalOpens.toLocaleString()} />
                    <StatCard title="Total Deliveries" value={insights.totalDeliveries.toLocaleString()} />
                    <StatCard title="Avg. Opens/Post" value={insights.averageOpensPerPost.toLocaleString()} />
                </div>
                 <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 lg:col-span-1">
                    <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Post Type Distribution</h4>
                    <div className="space-y-2">
                        {Object.entries(insights.postTypeCounts).map(([type, count]) => (
                             <div key={type} className="flex items-center">
                                <span className="w-24 capitalize text-sm text-gray-300 truncate">{type.replace('_', ' ')}</span>
                                <div className="flex-1 bg-gray-700 rounded-full h-4 mr-2">
                                    <div
                                        className={`${postTypeColors[type.toLowerCase()] || 'bg-gray-500'} h-4 rounded-full`}
                                        style={{ width: `${maxTypeCount > 0 ? (count / maxTypeCount) * 100 : 0}%` }}
                                        title={`${count} posts`}
                                    ></div>
                                </div>
                                <span className="text-sm font-semibold text-gray-200">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div>
                 <input
                    type="text"
                    placeholder="Search posts by title or subtitle..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 placeholder-gray-500 mb-6"
                />
                <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('title')}>Title <SortArrow columnKey="title" /></th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('post_date')}>Date <SortArrow columnKey="post_date" /></th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('type')}>Type <SortArrow columnKey="type" /></th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('audience')}>Audience <SortArrow columnKey="audience" /></th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('word_count')}>Words <SortArrow columnKey="word_count" /></th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('total_opens')}>Opens <SortArrow columnKey="total_opens" /></th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('total_deliveries')}>Deliveries <SortArrow columnKey="total_deliveries" /></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {sortedAndFilteredPosts.map((post, index) => (
                                <tr key={post.post_id || index} className="hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                          <div className="text-sm font-medium text-blue-400">
                                            {post.title}
                                          </div>
                                        </a>
                                        {post.subtitle && <div className="text-xs text-gray-400 truncate max-w-xs">{post.subtitle}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(post.post_date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                                        post.type.toLowerCase().includes('post') ? 'bg-blue-900 text-blue-200' :
                                        post.type.toLowerCase().includes('newsletter') ? 'bg-blue-900 text-blue-200' :
                                        post.type.toLowerCase().includes('thread') ? 'bg-sky-900 text-sky-200' :
                                        post.type.toLowerCase().includes('podcast') ? 'bg-purple-900 text-purple-200' :
                                        'bg-gray-700 text-gray-300'
                                      }`}>
                                        {post.type}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                                        post.audience === 'only_paid' ? 'bg-yellow-900 text-yellow-200' :
                                        post.audience === 'everyone' ? 'bg-blue-900 text-blue-200' :
                                        'bg-gray-700 text-gray-300'
                                      }`}>
                                        {post.audience.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">{post.word_count?.toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">{post.total_opens?.toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">{post.total_deliveries?.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PostInsights;