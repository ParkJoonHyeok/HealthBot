package kr.healbot.user;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
@Mapper
public interface UserMapper {
    @Insert("""
        INSERT INTO app_user(id, email, password_hash, display_name)
        VALUES (CAST(#{id} AS uuid), #{email}, #{passwordHash}, #{displayName})
        """)
    int insert(@Param("id") String id, @Param("email") String email,
               @Param("passwordHash") String passwordHash, @Param("displayName") String displayName);
    @Select("SELECT id::text FROM app_user WHERE lower(email) = lower(#{email}) AND status = 'ACTIVE'")
    String findActiveIdByEmail(@Param("email") String email);
}
