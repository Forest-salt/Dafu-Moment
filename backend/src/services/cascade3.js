/** Polymorphic references have no FK cascade; caller must use its existing transaction. */
async function replies(conn,parentType,parentId){
    const [rs]=await conn.query('SELECT id FROM review_reply WHERE parent_type=? AND parent_id=? AND deleted_at IS NULL FOR UPDATE',[parentType,parentId]);
    for(const r of rs){
        await conn.query('UPDATE review_like SET deleted_at=NOW() WHERE biz_type=3 AND biz_id=? AND deleted_at IS NULL',[r.id]);
    }
    await conn.query('UPDATE review_reply SET deleted_at=NOW() WHERE parent_type=? AND parent_id=? AND deleted_at IS NULL',[parentType,parentId]);
}
async function posts_for_journal(conn,journalId){
    const [rs]=await conn.query('SELECT id FROM post WHERE journal_id=? AND deleted_at IS NULL FOR UPDATE',[journalId]);
    for(const p of rs){
        await replies(conn,1,p.id);
        await conn.query('UPDATE review_like SET deleted_at=NOW() WHERE biz_type=2 AND biz_id=? AND deleted_at IS NULL',[p.id]);
        await conn.query('UPDATE favorite SET deleted_at=NOW() WHERE biz_type=4 AND biz_id=? AND deleted_at IS NULL',[p.id]);
        // report has no deleted_at in3.0; retain moderation history instead of deleting audit records.
    }
    await conn.query('UPDATE post SET deleted_at=NOW() WHERE journal_id=? AND deleted_at IS NULL',[journalId]);
}
module.exports={replies,posts_for_journal};
