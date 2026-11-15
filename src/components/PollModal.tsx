'use client';

import React, { useState } from 'react';
import { BarChart3, Plus, Trash2, X, Check, HelpCircle, Sparkles } from 'lucide-react';
import { MessagePoll } from '@/lib/types';

interface PollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePoll: (poll: MessagePoll) => void;
}

export function PollModal({ isOpen, onClose, onCreatePoll }: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [isQuiz, setIsQuiz] = useState(false);
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [explanation, setExplanation] = useState('');

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 8) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const next = options.filter((_, i) => i !== index);
      setOptions(next);
      if (correctIndex >= next.length) {
        setCorrectIndex(0);
      }
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const next = [...options];
    next[index] = val;
    setOptions(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQ = question.trim();
    const cleanOpts = options.map((o) => o.trim()).filter(Boolean);

    if (!cleanQ) {
      alert('Please enter a poll question.');
      return;
    }
    if (cleanOpts.length < 2) {
      alert('Please enter at least 2 options.');
      return;
    }

    const newPoll: MessagePoll = {
      id: `poll-${Date.now()}`,
      question: cleanQ,
      options: cleanOpts.map((text, idx) => ({
        text,
        votes: 0,
        isCorrect: isQuiz ? idx === correctIndex : undefined,
      })),
      totalVotes: 0,
      isQuiz,
      correctOptionIndex: isQuiz ? correctIndex : undefined,
      explanation: isQuiz && explanation.trim() ? explanation.trim() : undefined,
    };

    onCreatePoll(newPoll);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-stone-200/90 w-full max-w-sm rounded-2xl shadow-2xl p-5 text-stone-900 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-stone-900">
                {isQuiz ? 'Create Telegram Quiz' : 'Create Poll'}
              </h2>
              <p className="text-[10px] text-stone-400 font-mono">Interactive community choices</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Question */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Poll Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-800 transition"
              required
            />
          </div>

          {/* Options */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Options ({options.length}/8)
            </label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  {isQuiz && (
                    <button
                      type="button"
                      onClick={() => setCorrectIndex(idx)}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition ${
                        correctIndex === idx
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-stone-300 hover:border-emerald-400'
                      }`}
                      title={correctIndex === idx ? 'Correct answer' : 'Mark as correct answer'}
                    >
                      {correctIndex === idx && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                  )}
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-800 transition"
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-1.5 text-stone-400 hover:text-red-500 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 8 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2 text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add an option</span>
              </button>
            )}
          </div>

          {/* Quiz Mode Toggle */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-stone-800">Quiz Mode</span>
              <p className="text-[10px] text-stone-400">Has one correct answer and explanation</p>
            </div>
            <button
              type="button"
              onClick={() => setIsQuiz(!isQuiz)}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                isQuiz ? 'bg-sky-600' : 'bg-stone-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-xs absolute top-0.5 transition-transform ${
                  isQuiz ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Quiz explanation */}
          {isQuiz && (
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-stone-600">
                Explanation (Optional)
              </label>
              <input
                type="text"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Why is this answer correct?"
                className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-800 transition"
              />
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-stone-100 flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition cursor-pointer shadow-xs"
            >
              Post Poll
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
