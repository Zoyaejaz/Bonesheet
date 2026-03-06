import React, { useState } from 'react';
import { X, HelpCircle, Settings, Link2, Globe, Lock, Copy, Check, User } from 'lucide-react';
import { useSpreadsheetStore } from '@/store/useSpreadsheetStore';
import { useAuth } from '@/hooks/useAuth';
import clsx from 'clsx';

interface ShareModalProps {
  onClose: () => void;
}

export function ShareModal({ onClose }: ShareModalProps) {
  const { user } = useAuth();
  const document = useSpreadsheetStore(state => state.document);
  const documentId = useSpreadsheetStore(state => state.documentId);
  const updateShareSettings = useSpreadsheetStore(state => state.updateShareSettings);
  
  const [emailInput, setEmailInput] = useState('');
  const [copied, setCopied] = useState(false);

  if (!document || !documentId) return null;

  const isOwner = user?.uid === document.ownerId;
  const collaborators = document.collaborators || {};
  const isPublic = document.isPublic || false;
  const publicRole = document.publicRole || 'Viewer';

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    
    const newCollabs = { ...collaborators, [emailInput.trim()]: 'Editor' as const };
    updateShareSettings({ collaborators: newCollabs });
    setEmailInput('');
  };

  const handleRemoveCollaborator = (email: string) => {
    const newCollabs = { ...collaborators };
    delete newCollabs[email];
    updateShareSettings({ collaborators: newCollabs });
  };

  const handleRoleChange = (email: string, role: 'Editor' | 'Viewer') => {
    const newCollabs = { ...collaborators, [email]: role };
    updateShareSettings({ collaborators: newCollabs });
  };

  const handlePublicAccessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'restricted') {
      updateShareSettings({ isPublic: false });
    } else {
      updateShareSettings({ isPublic: true });
    }
  };

  const handlePublicRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateShareSettings({ publicRole: e.target.value as 'Editor' | 'Viewer' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-[90vw] overflow-hidden flex flex-col font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-medium text-gray-800">Share &quot;{document.title}&quot;</h2>
          <div className="flex items-center space-x-2 text-gray-500">
            <button className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><HelpCircle className="w-5 h-5" /></button>
            <button className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><Settings className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          
          {/* Add People Input */}
          <form onSubmit={handleAddCollaborator} className="mb-6 relative">
            <input
              type="text"
              placeholder="Add people, groups, spaces, and calendar events"
              className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              disabled={!isOwner}
            />
          </form>

          {/* People with access */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">People with access</h3>
            <div className="space-y-4">
              {/* Owner */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center font-medium text-sm">
                    {document.ownerName ? document.ownerName[0].toUpperCase() : 'O'}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 flex items-center">
                      {document.ownerName || 'Owner'}
                      {user?.uid === document.ownerId && <span className="text-gray-500 font-normal ml-1">(you)</span>}
                    </div>
                    <div className="text-xs text-gray-500">{document.ownerEmail || 'Unknown email'}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-500 mr-2">Owner</div>
              </div>

              {/* Collaborators */}
              {Object.entries(collaborators).map(([email, role]) => (
                <div key={email} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium text-sm">
                      {email[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 flex items-center">
                        {email.split('@')[0]}
                        {user?.email === email && <span className="text-gray-500 font-normal ml-1">(you)</span>}
                      </div>
                      <div className="text-xs text-gray-500">{email}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      className="text-sm text-gray-600 border-none bg-transparent hover:bg-gray-100 focus:outline-none cursor-pointer p-1 rounded"
                      value={role}
                      onChange={(e) => {
                        if (e.target.value === 'Remove') {
                          handleRemoveCollaborator(email);
                        } else {
                          handleRoleChange(email, e.target.value as 'Editor' | 'Viewer');
                        }
                      }}
                      disabled={!isOwner && user?.email !== email}
                    >
                      <option value="Editor">Editor</option>
                      <option value="Viewer">Viewer</option>
                      {isOwner && <option value="Remove">Remove access</option>}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* General access */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">General access</h3>
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="mt-0.5 p-2 bg-gray-200 rounded-full text-gray-600">
                {isPublic ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <select 
                  className="font-medium text-sm text-gray-900 border-none bg-transparent focus:outline-none p-0 cursor-pointer block mb-0.5"
                  value={isPublic ? "public" : "restricted"}
                  onChange={handlePublicAccessChange}
                  disabled={!isOwner}
                >
                  <option value="restricted">Restricted</option>
                  <option value="public">Anyone with the link</option>
                </select>
                <div className="text-xs text-gray-500">
                  {isPublic 
                    ? "Anyone on the internet with the link can view" 
                    : "Only people with access can open with the link"}
                </div>
              </div>
              {isPublic && (
                <select 
                  className="text-sm text-gray-600 border-none bg-transparent hover:bg-gray-200 focus:outline-none cursor-pointer p-1 rounded"
                  value={publicRole}
                  onChange={handlePublicRoleChange}
                  disabled={!isOwner}
                >
                  <option value="Viewer">Viewer</option>
                  <option value="Editor">Editor</option>
                </select>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button 
            onClick={handleCopyLink}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-full transition-colors border border-blue-200"
          >
            {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            <span>{copied ? 'Link copied' : 'Copy link'}</span>
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
