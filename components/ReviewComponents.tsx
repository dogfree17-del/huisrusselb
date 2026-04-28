import React, { useState } from 'react';
import { NeuCard, NeuButton, NeuTextarea } from './NeuComponents';
import { Icons } from './Icons';
import { Review } from '../types';
import { DataService } from '../services/supabase';

export const ReviewSubmission = ({ providerId, userId, userName, onSubmitted }: { providerId: string, userId: string, userName: string, onSubmitted: () => void }) => {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!comment.trim()) return;
        setIsSubmitting(true);
        try {
            await DataService.addReview({
                providerId,
                userId,
                userName,
                rating,
                comment,
                createdAt: new Date().toISOString()
            });
            setComment('');
            setRating(5);
            onSubmitted();
        } catch (e) {
            console.error("Error submitting review:", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="glass-card p-8 space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
                <h3 className="font-black italic text-2xl uppercase tracking-tighter text-slate-900 leading-none">Share Your Experience</h3>
                <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((r) => (
                        <button 
                            key={r} 
                            onClick={() => setRating(r)} 
                            className={`p-2 rounded-xl transition-all transform active:scale-95 ${r <= rating ? 'text-amber-400 bg-amber-50' : 'text-slate-300 hover:bg-slate-50'}`}
                        >
                            <Icons.Star className="w-6 h-6" fill={r <= rating ? "currentColor" : "none"} />
                        </button>
                    ))}
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Your Feedback</label>
                <textarea 
                    value={comment} 
                    onChange={e => setComment(e.target.value)} 
                    placeholder="Tell others about your experience..." 
                    rows={4}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-brand-pink/30 focus:bg-white outline-none p-4 rounded-2xl font-bold text-slate-800 transition-all resize-none"
                />
            </div>
            <button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !comment.trim()}
                className="w-full flex items-center justify-center px-8 py-4 rounded-2xl bg-brand-pink text-white shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all transform active:scale-95 font-black text-[10px] uppercase tracking-[0.25em] italic disabled:opacity-50"
            >
                {isSubmitting ? <Icons.Loader2 className="w-5 h-5 animate-spin" /> : 'Post Review'}
            </button>
        </div>
    );
};

export const ReviewList = ({ providerId }: { providerId: string }) => {
    const [reviews, setReviews] = useState<Review[]>([]);

    React.useEffect(() => {
        const unsubscribe = DataService.subscribeToReviews(providerId, setReviews);
        return () => { unsubscribe(); };
    }, [providerId]);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h3 className="font-black italic text-2xl uppercase tracking-tighter text-slate-900 leading-none">Community Reviews</h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-full">{reviews.length} Reviews</span>
            </div>
            
            <div className="grid gap-6">
                {reviews.map((review, idx) => (
                    <div key={review.id} className="glass-card p-6 space-y-4 animate-slide-up" style={{ animationDelay: `${idx * 100}ms` }}>
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-sm italic">
                                    {review.userName.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-black text-sm text-slate-900 uppercase italic tracking-tighter">{review.userName}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(review.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                    <Icons.Star 
                                        key={i} 
                                        className={`w-3.5 h-3.5 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} 
                                    />
                                ))}
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed italic">"{review.comment}"</p>
                    </div>
                ))}
                {reviews.length === 0 && (
                    <div className="py-12 text-center text-slate-400 font-black uppercase tracking-widest italic text-[10px] border-4 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30">
                        No reviews yet. Be the first!
                    </div>
                )}
            </div>
        </div>
    );
};
