"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  addGroupMember,
  createGroup,
  createGroupInviteLink,
  fetchGroupDetail,
  fetchGroups,
  GroupCallMode,
  GroupCallState,
  GroupDetail,
  GroupSummary,
  joinGroupByInvite,
  leaveGroup,
  pinGroupMessage,
  promoteGroupMember,
  removeGroupMember,
  setGroupNickname,
  unpinGroupMessage,
  updateGroupCallState,
} from "@/lib/groups";

interface ActionResult {
  ok: boolean;
  message: string;
}

function ResultBanner({ result }: { result: ActionResult | null }) {
  if (!result) return null;

  return (
    <p
      className={`rounded-md border px-3 py-2 text-sm ${
        result.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {result.message}
    </p>
  );
}

export default function GroupApiPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupEmoji, setNewGroupEmoji] = useState("");
  const [newGroupAvatar, setNewGroupAvatar] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");

  const [inviteCode, setInviteCode] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [nickname, setNickname] = useState("");
  const [messageId, setMessageId] = useState("");
  const [callMode, setCallMode] = useState<GroupCallMode>("voice");
  const [callState, setCallState] = useState<GroupCallState>("ringing");

  const selectedGroup = useMemo(
    () => groups.find((item) => item.groupId === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const runAction = async (task: () => Promise<void>) => {
    setLoading(true);
    setResult(null);

    try {
      await task();
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Thao tac that bai",
      });
    } finally {
      setLoading(false);
    }
  };

  const reloadGroups = async () => {
    const items = await fetchGroups();
    setGroups(items);
  };

  const loadDetail = async (groupId: string) => {
    const detail = await fetchGroupDetail(groupId);
    setGroupDetail(detail);
  };

  const onLoadGroups = () => {
    void runAction(async () => {
      await reloadGroups();
      setResult({ ok: true, message: "Da tai danh sach group" });
    });
  };

  const onSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    void runAction(async () => {
      await loadDetail(groupId);
      setResult({ ok: true, message: "Da tai chi tiet group" });
    });
  };

  const onCreateGroup = (event: FormEvent) => {
    event.preventDefault();

    void runAction(async () => {
      const created = await createGroup({
        name: newGroupName.trim(),
        emoji: newGroupEmoji.trim() || undefined,
        avatarUrl: newGroupAvatar.trim() || undefined,
        description: newGroupDescription.trim() || undefined,
      });
      await reloadGroups();
      setSelectedGroupId(created.groupId);
      await loadDetail(created.groupId);
      setResult({ ok: true, message: `Tao group thanh cong: ${created.name}` });
      setNewGroupName("");
      setNewGroupEmoji("");
      setNewGroupAvatar("");
      setNewGroupDescription("");
    });
  };

  const onJoinByInvite = (event: FormEvent) => {
    event.preventDefault();

    void runAction(async () => {
      const joined = await joinGroupByInvite(inviteCode.trim());
      await reloadGroups();
      setSelectedGroupId(joined.groupId);
      await loadDetail(joined.groupId);
      setResult({
        ok: true,
        message: `Join group thanh cong (${joined.groupId})`,
      });
      setInviteCode("");
    });
  };

  const runGroupAction = (task: (groupId: string) => Promise<void>) => {
    if (!selectedGroupId) {
      setResult({ ok: false, message: "Chon group truoc khi thao tac" });
      return;
    }

    void runAction(async () => {
      await task(selectedGroupId);
      await reloadGroups();
      await loadDetail(selectedGroupId);
    });
  };

  return (
    <main className="flex min-h-screen bg-[#f8f9fb] text-[#191c1e]">
      <aside className="hidden w-16 flex-col items-center bg-[#e7e8ea] py-4 md:flex">
        <div className="mb-8 h-10 w-10 rounded-full bg-zinc-300" />
        <Link
          href="/chat/me"
          className="rounded-lg p-3 text-zinc-500 hover:bg-[#e1e2e4]"
        >
          <span className="text-xs font-bold">TM</span>
        </Link>
        <Link
          href="/contacts"
          className="mt-4 rounded-lg p-3 text-zinc-500 hover:bg-[#e1e2e4]"
        >
          <span className="text-xs font-bold">DB</span>
        </Link>
        <Link
          href="/chat/groups"
          className="mt-4 rounded-lg bg-linear-to-br from-[#0052cc] to-[#0068ff] p-3 text-white"
        >
          <span className="text-xs font-bold">GR</span>
        </Link>
      </aside>

      <section className="flex w-full flex-1 flex-col gap-4 p-4 md:ml-0 md:grid md:grid-cols-[360px_1fr]">
        <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black">Group APIs</h1>
            <button
              type="button"
              onClick={onLoadGroups}
              disabled={loading}
              className="rounded-md bg-[#0052cc] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <ResultBanner result={result} />

          <form
            onSubmit={onCreateGroup}
            className="space-y-2 rounded-xl border border-zinc-200 p-3"
          >
            <p className="text-sm font-semibold">1. Tao group</p>
            <input
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="Ten group"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none"
              required
            />
            <input
              value={newGroupEmoji}
              onChange={(event) => setNewGroupEmoji(event.target.value)}
              placeholder="Emoji (optional)"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none"
            />
            <input
              value={newGroupAvatar}
              onChange={(event) => setNewGroupAvatar(event.target.value)}
              placeholder="Avatar URL (optional)"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none"
            />
            <textarea
              value={newGroupDescription}
              onChange={(event) => setNewGroupDescription(event.target.value)}
              placeholder="Mo ta (optional)"
              className="h-20 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Tao group
            </button>
          </form>

          <form
            onSubmit={onJoinByInvite}
            className="space-y-2 rounded-xl border border-zinc-200 p-3"
          >
            <p className="text-sm font-semibold">2. Join bang invite code</p>
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Invite code"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Join group
            </button>
          </form>

          <div className="rounded-xl border border-zinc-200 p-3">
            <p className="mb-2 text-sm font-semibold">3. Danh sach group</p>
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {groups.map((group) => (
                <li key={group.groupId}>
                  <button
                    type="button"
                    onClick={() => onSelectGroup(group.groupId)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      selectedGroupId === group.groupId
                        ? "border-[#0052cc] bg-[#eef3ff]"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <p className="font-semibold">
                      {group.emoji ? `${group.emoji} ` : ""}
                      {group.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {group.groupId} | role {group.role} | {group.memberCount}{" "}
                      members
                    </p>
                  </button>
                </li>
              ))}
              {groups.length === 0 ? (
                <li className="text-xs text-zinc-500">Chua co group</li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">Group actions</h2>
          <p className="text-xs text-zinc-500">
            Selected: {selectedGroup?.name ?? "N/A"}{" "}
            {selectedGroupId ? `(${selectedGroupId})` : ""}
          </p>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
              <p className="text-sm font-semibold">Membership & role</p>
              <input
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
                placeholder="targetUserId (UUID)"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading || !targetUserId}
                  onClick={() =>
                    runGroupAction(async (groupId) => {
                      await addGroupMember(groupId, targetUserId.trim());
                      setResult({ ok: true, message: "Da them member" });
                    })
                  }
                  className="rounded-md bg-[#0052cc] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Add member
                </button>
                <button
                  type="button"
                  disabled={loading || !targetUserId}
                  onClick={() =>
                    runGroupAction(async (groupId) => {
                      await removeGroupMember(groupId, targetUserId.trim());
                      setResult({ ok: true, message: "Da xoa member" });
                    })
                  }
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Remove member
                </button>
                <button
                  type="button"
                  disabled={loading || !targetUserId}
                  onClick={() =>
                    runGroupAction(async (groupId) => {
                      await promoteGroupMember(groupId, targetUserId.trim());
                      setResult({
                        ok: true,
                        message: "Da promote member len admin",
                      });
                    })
                  }
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Promote admin
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    runGroupAction(async (groupId) => {
                      await leaveGroup(groupId);
                      setResult({ ok: true, message: "Da roi group" });
                      setSelectedGroupId("");
                      setGroupDetail(null);
                    })
                  }
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  Leave group
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
              <p className="text-sm font-semibold">Invite & nickname</p>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="Nickname in group"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    runGroupAction(async (groupId) => {
                      const invite = await createGroupInviteLink(groupId);
                      setResult({
                        ok: true,
                        message: `Invite: ${invite.inviteLink}`,
                      });
                    })
                  }
                  className="rounded-md bg-[#0052cc] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Create invite link
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    runGroupAction(async (groupId) => {
                      await setGroupNickname(
                        groupId,
                        nickname.trim() || undefined,
                      );
                      setResult({ ok: true, message: "Da cap nhat nickname" });
                    })
                  }
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  Set nickname
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
              <p className="text-sm font-semibold">Pin message</p>
              <input
                value={messageId}
                onChange={(event) => setMessageId(event.target.value)}
                placeholder="Message ID"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading || !messageId}
                  onClick={() =>
                    runGroupAction(async (groupId) => {
                      await pinGroupMessage(groupId, messageId.trim());
                      setResult({ ok: true, message: "Da pin message" });
                    })
                  }
                  className="rounded-md bg-[#0052cc] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Pin
                </button>
                <button
                  type="button"
                  disabled={loading || !messageId}
                  onClick={() =>
                    runGroupAction(async (groupId) => {
                      await unpinGroupMessage(groupId, messageId.trim());
                      setResult({ ok: true, message: "Da unpin message" });
                    })
                  }
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  Unpin
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
              <p className="text-sm font-semibold">Group call status</p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={callMode}
                  onChange={(event) =>
                    setCallMode(event.target.value as GroupCallMode)
                  }
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none"
                >
                  <option value="voice">voice</option>
                  <option value="video">video</option>
                </select>
                <select
                  value={callState}
                  onChange={(event) =>
                    setCallState(event.target.value as GroupCallState)
                  }
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none"
                >
                  <option value="ringing">ringing</option>
                  <option value="active">active</option>
                  <option value="ended">ended</option>
                </select>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  runGroupAction(async (groupId) => {
                    await updateGroupCallState(groupId, callMode, callState);
                    setResult({
                      ok: true,
                      message: `Da update call state -> ${callMode}/${callState}`,
                    });
                  })
                }
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Update call state
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 p-3">
            <p className="mb-2 text-sm font-semibold">Group detail</p>
            {groupDetail ? (
              <div className="space-y-2 text-xs text-zinc-700">
                <p>
                  Name: {groupDetail.emoji ? `${groupDetail.emoji} ` : ""}
                  {groupDetail.name}
                </p>
                <p>Members: {groupDetail.memberCount}</p>
                <p>
                  Call state:{" "}
                  {groupDetail.callState
                    ? `${groupDetail.callState.mode}/${groupDetail.callState.state}`
                    : "none"}
                </p>
                <p className="font-semibold">Members list</p>
                <ul className="space-y-1">
                  {groupDetail.members.map((member) => (
                    <li
                      key={member.userId}
                      className="rounded-md bg-zinc-50 px-2 py-1"
                    >
                      {member.name} ({member.userId}) - {member.role}
                      {member.nickname ? ` - nick: ${member.nickname}` : ""}
                      {member.isOnline ? " - online" : " - offline"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Chua chon group</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
